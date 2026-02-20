export const runtime = 'edge';

import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient, hasSupabaseAdminEnv } from '@/lib/supabase/admin';
import { getCategoryVariants, normalizeSubCategory } from '@/lib/dashboard/category-normalize';

const ANALYSIS_COUNTRIES = ['mix', 'kr', 'us'];
const ANALYSIS_LIMIT = 5;
const MAX_SERIES_POINTS = 5;
const QUEUE_COOLDOWN_MS = 10 * 60 * 1000;
const CACHE_MAX_AGE_SECONDS = Math.max(5, parsePositiveInt(process.env.DASHBOARD_SERIES_CACHE_MAX_AGE, 30));
const CACHE_STALE_SECONDS = Math.max(30, parsePositiveInt(process.env.DASHBOARD_SERIES_CACHE_STALE, 120));
const PROCESSING_STALE_MINUTES = parsePositiveInt(
  process.env.DASHBOARD_SEED_PROCESSING_STALE_MINUTES,
  5,
);
const PROCESSING_STALE_MS = PROCESSING_STALE_MINUTES * 60 * 1000;
const queueInFlight = new Map();
const recentQueueAt = new Map();

function parsePositiveInt(value, fallbackValue) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue;
}

const MIN_SERIES_POINTS = Math.min(
  MAX_SERIES_POINTS,
  Math.max(2, parsePositiveInt(process.env.DASHBOARD_MIN_POINTS, 3)),
);

const STALE_MINUTES = Math.max(1, parsePositiveInt(process.env.DASHBOARD_STALE_MINUTES, 15));
const STALE_MS = STALE_MINUTES * 60 * 1000;

function isMissingColumnError(error, columnName) {
  if (!error) return false;
  if (error.code === '42703' || error.code === 'PGRST204') return true;
  return String(error.message || '').toLowerCase().includes(columnName.toLowerCase());
}

function isMissingTableError(error, tableName) {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  const message = String(error.message || '').toLowerCase();
  return tableName ? message.includes(tableName.toLowerCase()) && message.includes('does not exist') : false;
}

function mergeReferences(primary, fallback) {
  const refs = Array.isArray(primary) ? primary : [];
  const fallbackRefs = Array.isArray(fallback) ? fallback : [];
  const usedKeys = new Set();

  const makeKey = (item) => `${item?.source_type || ''}::${item?.url || ''}::${item?.title || ''}`;
  const pushUnique = (target, item) => {
    if (!item?.title || !item?.url || !item?.source_type) return;
    const key = makeKey(item);
    if (usedKeys.has(key)) return;
    usedKeys.add(key);
    target.push(item);
  };

  const news = [];
  const bills = [];

  for (const item of refs) {
    if (item?.source_type === 'news') pushUnique(news, item);
    if (item?.source_type === 'bill') pushUnique(bills, item);
  }

  for (const item of fallbackRefs) {
    if (item?.source_type === 'news' && news.length < 4) pushUnique(news, item);
    if (item?.source_type === 'bill' && bills.length < 2) pushUnique(bills, item);
  }

  return [...news.slice(0, 4), ...bills.slice(0, 2)];
}

function pickSourceTier(references) {
  const tiers = new Set(
    (references || [])
      .map((item) => item?.source_tier)
      .filter((item) => typeof item === 'string' && item.length > 0),
  );

  if (tiers.has('db')) return 'db';
  if (tiers.has('global')) return 'global';
  if (tiers.has('related')) return 'related';
  if (tiers.has('category')) return 'category';
  return null;
}

async function fetchFallbackReferences(supabase, subCategoryVariants) {
  const variants = (subCategoryVariants || []).filter(Boolean);
  let rows = [];

  if (variants.length > 0) {
    const byCategory = await supabase
      .from('raw_items')
      .select('title, url, source_type, published_at')
      .in('source_type', ['news', 'bill'])
      .in('category', variants)
      .order('published_at', { ascending: false })
      .limit(40);
    rows = byCategory.data || [];
  }

  if (!rows.length) {
    const recentRows = await supabase
      .from('raw_items')
      .select('title, url, source_type, published_at')
      .in('source_type', ['news', 'bill'])
      .order('published_at', { ascending: false })
      .limit(120);
    rows = recentRows.data || [];
  }

  const cleaned = (rows || []).filter((item) => item?.title && item?.url);
  const seen = new Set();

  const normalize = (item) => ({
    title: item.title,
    url: item.url,
    source_type: item.source_type,
    source_tier: 'db',
  });
  const keyOf = (item) => `${item.source_type}::${item.url}`;
  const pushUnique = (target, item) => {
    const key = keyOf(item);
    if (seen.has(key)) return;
    seen.add(key);
    target.push(item);
  };

  const newsRefs = [];
  const billRefs = [];

  for (const item of cleaned) {
    const normalized = normalize(item);
    if (normalized.source_type === 'news' && newsRefs.length < 4) {
      pushUnique(newsRefs, normalized);
    }
    if (normalized.source_type === 'bill' && billRefs.length < 2) {
      pushUnique(billRefs, normalized);
    }
    if (newsRefs.length >= 4 && billRefs.length >= 2) break;
  }

  return [...newsRefs, ...billRefs];
}

function getMinimumSeriesPoints() {
  return MIN_SERIES_POINTS;
}

function cleanupOldQueueAttempts(nowMs) {
  for (const [category, attemptedAt] of recentQueueAt.entries()) {
    if (nowMs - attemptedAt > QUEUE_COOLDOWN_MS) {
      recentQueueAt.delete(category);
    }
  }
}

async function queueSeedRequest(subCategory, reason, options = {}) {
  if (!subCategory) {
    return { queued: false, status: 'invalid_sub_category' };
  }
  if (!hasSupabaseAdminEnv()) {
    return { queued: false, status: 'queue_unavailable' };
  }

  const force = options.force === true;

  const existingTask = queueInFlight.get(subCategory);
  if (existingTask) {
    return existingTask;
  }

  const task = (async () => {
    const nowMs = Date.now();
    cleanupOldQueueAttempts(nowMs);

    const lastAttemptedAt = recentQueueAt.get(subCategory);
    if (!force && lastAttemptedAt && nowMs - lastAttemptedAt < QUEUE_COOLDOWN_MS) {
      return { queued: false, status: 'cooldown' };
    }

    const admin = createAdminClient();
    let existing;
    try {
      const { data, error } = await admin
        .from('seed_requests')
        .select('status, requested_at, attempts')
        .eq('sub_category', subCategory)
        .maybeSingle();

      if (isMissingTableError(error, 'seed_requests')) {
        return { queued: false, status: 'queue_unavailable' };
      }
      if (error) {
        return { queued: false, status: 'queue_failed', error: error.message };
      }
      existing = data;
    } catch (error) {
      return { queued: false, status: 'queue_failed', error: error.message };
    }

    const lastRequestedMs = existing?.requested_at ? new Date(existing.requested_at).getTime() : 0;
    const processingFresh =
      existing?.status === 'processing' &&
      Number.isFinite(lastRequestedMs) &&
      nowMs - lastRequestedMs < PROCESSING_STALE_MS;

    if (!force && processingFresh) {
      return { queued: false, status: 'processing' };
    }

    if (!force && Number.isFinite(lastRequestedMs) && nowMs - lastRequestedMs < QUEUE_COOLDOWN_MS) {
      return { queued: false, status: 'cooldown' };
    }

    recentQueueAt.set(subCategory, nowMs);

    const payload = {
      sub_category: subCategory,
      requested_at: new Date().toISOString(),
      last_attempt_at: new Date().toISOString(),
      status: 'pending',
      attempts: Number(existing?.attempts || 0),
      last_error: reason || null,
    };

    let { error: upsertError } = await admin
      .from('seed_requests')
      .upsert(payload, { onConflict: 'sub_category' });

    if (isMissingColumnError(upsertError, 'last_attempt_at')) {
      const { last_attempt_at, ...withoutLastAttempt } = payload;
      ({ error: upsertError } = await admin
        .from('seed_requests')
        .upsert(withoutLastAttempt, { onConflict: 'sub_category' }));
    }

    if (isMissingTableError(upsertError, 'seed_requests')) {
      return { queued: false, status: 'queue_unavailable' };
    }

    if (upsertError) {
      return { queued: false, status: 'queue_failed', error: upsertError.message };
    }

    return { queued: true, status: 'pending' };
  })();

  queueInFlight.set(subCategory, task);

  try {
    return await task;
  } finally {
    queueInFlight.delete(subCategory);
  }
}

async function loadSeriesRows(supabase, subCategoryVariants) {
  const variants = (subCategoryVariants || []).filter(Boolean);

  const runQuery = (columns) =>
    supabase
      .from('hourly_analysis')
      .select(columns)
      .in('country', ANALYSIS_COUNTRIES)
      .in('sub_category', variants)
      .order('analyzed_at', { ascending: false })
      .limit(ANALYSIS_LIMIT);

  let includeReferences = true;
  let { data: analysis, error } = await runQuery('score, label, comment, references, analyzed_at, sub_category');

  if (isMissingColumnError(error, 'references')) {
    includeReferences = false;
    ({ data: analysis, error } = await runQuery('score, label, comment, analyzed_at, sub_category'));
  }

  return { analysis, error, includeReferences };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const requestedSubCategory = searchParams.get('sub');
  const forceRefresh = searchParams.get('refresh') === '1';

  if (!requestedSubCategory) {
    return NextResponse.json({ error: 'Missing sub parameter' }, { status: 400 });
  }

  const canonicalSubCategory = normalizeSubCategory(requestedSubCategory);
  if (!canonicalSubCategory) {
    return NextResponse.json({ error: 'Invalid sub parameter' }, { status: 400 });
  }

  const subCategoryVariants = getCategoryVariants(requestedSubCategory);
  if (!subCategoryVariants.includes(canonicalSubCategory)) {
    subCategoryVariants.push(canonicalSubCategory);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (process.env.USE_MOCK_ANALYSIS === 'true') {
    const { generateMockSeries } = require('@/lib/mock/generator');
    const mockSeries = generateMockSeries(user.id, canonicalSubCategory);
    return NextResponse.json({
      series: mockSeries,
      meta: {
        stale: false,
        lastAnalyzedAt: mockSeries[mockSeries.length - 1]?.timestamp || null,
        seedQueued: false,
        seedReason: 'fresh',
        seedStatus: null,
        sourceTier: 'category',
      },
    });
  }

  let { analysis, error, includeReferences } = await loadSeriesRows(supabase, subCategoryVariants);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const sorted = (analysis || []).reverse();

  const series = sorted.map((item) => ({
    timestamp: item.analyzed_at,
    score: item.score,
    label: item.label,
    comment: item.comment || '',
    references: includeReferences && Array.isArray(item.references) ? item.references : [],
  }));

  if (series.length > 0) {
    const fallbackReferences = await fetchFallbackReferences(supabase, subCategoryVariants);
    const latestReferences = series[series.length - 1].references;

    if (!includeReferences) {
      series[series.length - 1].references = mergeReferences([], fallbackReferences);
    } else {
      series[series.length - 1].references = mergeReferences(latestReferences, fallbackReferences);
    }
  }

  const lastAnalyzedAt = series.length > 0 ? series[series.length - 1].timestamp : null;
  const lastAnalyzedMs = lastAnalyzedAt ? new Date(lastAnalyzedAt).getTime() : 0;
  const isStale = !lastAnalyzedMs || Date.now() - lastAnalyzedMs > STALE_MS;
  const insufficient = series.length < getMinimumSeriesPoints();
  const shouldQueue = forceRefresh || isStale || insufficient;
  const queueReason = forceRefresh ? 'manual_refresh' : isStale ? 'stale' : insufficient ? 'insufficient' : 'fresh';

  let queueResult = { queued: false, status: null };
  if (shouldQueue) {
    queueResult = await queueSeedRequest(canonicalSubCategory, queueReason, { force: forceRefresh });
  }

  const sourceTier = pickSourceTier(series[series.length - 1]?.references);

  return NextResponse.json(
    {
      series,
      meta: {
        stale: isStale,
        lastAnalyzedAt,
        seedQueued: Boolean(queueResult.queued),
        seedReason: queueReason,
        seedStatus: queueResult.status,
        sourceTier,
      },
    },
    {
      headers: {
        'Cache-Control': `private, max-age=${CACHE_MAX_AGE_SECONDS}, stale-while-revalidate=${CACHE_STALE_SECONDS}`,
      },
    },
  );
}
