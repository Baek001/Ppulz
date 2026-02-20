export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, hasSupabaseAdminEnv } from '@/lib/supabase/admin';

const ANALYSIS_COUNTRIES = ['mix', 'kr', 'us'];
const ANALYSIS_LIMIT = 5;
const MAX_SERIES_POINTS = 5;
const QUEUE_COOLDOWN_MS = 10 * 60 * 1000;
const CACHE_MAX_AGE_SECONDS = Math.max(5, parsePositiveInt(process.env.DASHBOARD_SERIES_CACHE_MAX_AGE, 30));
const CACHE_STALE_SECONDS = Math.max(30, parsePositiveInt(process.env.DASHBOARD_SERIES_CACHE_STALE, 120));
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
  if (error.code === '42703') return true;
  return String(error.message || '').toLowerCase().includes(columnName.toLowerCase());
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

async function fetchFallbackReferences(supabase, subCategory) {
  const { data, error } = await supabase
    .from('raw_items')
    .select('title, url, source_type, published_at')
    .in('source_type', ['news', 'bill'])
    .ilike('category', `%${subCategory}%`)
    .order('published_at', { ascending: false })
    .limit(40);

  if (error) {
    return [];
  }

  const cleaned = (data || []).filter((item) => item?.title && item?.url);
  const seen = new Set();

  const normalize = (item) => ({
    title: item.title,
    url: item.url,
    source_type: item.source_type,
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

  // If category-matched rows are sparse, backfill with recent rows.
  if (newsRefs.length < 4 || billRefs.length < 2) {
    const { data: recentRows, error: recentError } = await supabase
      .from('raw_items')
      .select('title, url, source_type, published_at')
      .in('source_type', ['news', 'bill'])
      .order('published_at', { ascending: false })
      .limit(120);

    if (!recentError) {
      for (const item of recentRows || []) {
        if (!item?.title || !item?.url) continue;
        const normalized = normalize(item);
        if (normalized.source_type === 'news' && newsRefs.length < 4) {
          pushUnique(newsRefs, normalized);
        }
        if (normalized.source_type === 'bill' && billRefs.length < 2) {
          pushUnique(billRefs, normalized);
        }
        if (newsRefs.length >= 4 && billRefs.length >= 2) break;
      }
    }
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

async function queueSeedRequest(subCategory, reason) {
  if (!hasSupabaseAdminEnv() || !subCategory) {
    return false;
  }

  const existingTask = queueInFlight.get(subCategory);
  if (existingTask) {
    return existingTask;
  }

  const task = (async () => {
    const nowMs = Date.now();
    cleanupOldQueueAttempts(nowMs);

    const lastAttemptedAt = recentQueueAt.get(subCategory);
    if (lastAttemptedAt && nowMs - lastAttemptedAt < QUEUE_COOLDOWN_MS) {
      return false;
    }

    const admin = createAdminClient();
    try {
      const { data: existing, error: existingError } = await admin
        .from('seed_requests')
        .select('status, requested_at')
        .eq('sub_category', subCategory)
        .maybeSingle();

      if (existingError) {
        return false;
      }

      if (existing?.status === 'processing') {
        return false;
      }

      const lastRequestedMs = existing?.requested_at ? new Date(existing.requested_at).getTime() : 0;
      if (Number.isFinite(lastRequestedMs) && nowMs - lastRequestedMs < QUEUE_COOLDOWN_MS) {
        return false;
      }
    } catch (error) {
      return false;
    }

    recentQueueAt.set(subCategory, nowMs);

    const payload = {
      sub_category: subCategory,
      requested_at: new Date().toISOString(),
      status: 'pending',
      last_error: reason || null,
    };

    const { error: upsertError } = await admin
      .from('seed_requests')
      .upsert(payload, { onConflict: 'sub_category' });

    return !upsertError;
  })();

  queueInFlight.set(subCategory, task);

  try {
    return await task;
  } finally {
    queueInFlight.delete(subCategory);
  }
}

async function loadSeriesRows(supabase, subCategory) {
  // Try fetching references first, then gracefully fallback for older schemas.
  const runQuery = (columns) =>
    supabase
      .from('hourly_analysis')
      .select(columns)
      .in('country', ANALYSIS_COUNTRIES)
      .eq('sub_category', subCategory)
      .order('analyzed_at', { ascending: false })
      .limit(ANALYSIS_LIMIT);

  let includeReferences = true;
  let { data: analysis, error } = await runQuery('score, label, comment, references, analyzed_at');

  if (isMissingColumnError(error, 'references')) {
    includeReferences = false;
    ({ data: analysis, error } = await runQuery('score, label, comment, analyzed_at'));
  }

  return { analysis, error, includeReferences };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const subCategory = searchParams.get('sub');

  if (!subCategory) {
    return NextResponse.json({ error: 'Missing sub parameter' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // FEATURE FLAG: Mock Data Mode
  if (process.env.USE_MOCK_ANALYSIS === 'true') {
    const { generateMockSeries } = require('@/lib/mock/generator');
    const mockSeries = generateMockSeries(user.id, subCategory);
    return NextResponse.json({ series: mockSeries });
  }

  let { analysis, error, includeReferences } = await loadSeriesRows(supabase, subCategory);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Reverse to show chronological order in graph.
  const sorted = (analysis || []).reverse();

  const series = sorted.map((item) => ({
    timestamp: item.analyzed_at,
    score: item.score,
    label: item.label,
    comment: item.comment || '',
    references: includeReferences && Array.isArray(item.references) ? item.references : [],
  }));

  if (series.length > 0) {
    const fallbackReferences = await fetchFallbackReferences(supabase, subCategory);
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
  const shouldQueue = isStale || insufficient;

  let seedQueued = false;
  if (shouldQueue) {
    seedQueued = await queueSeedRequest(subCategory, isStale ? 'stale' : 'insufficient');
  }

  return NextResponse.json(
    {
      series,
      meta: {
        stale: isStale,
        lastAnalyzedAt,
        seedQueued,
      },
    },
    {
      headers: {
        'Cache-Control': `private, max-age=${CACHE_MAX_AGE_SECONDS}, stale-while-revalidate=${CACHE_STALE_SECONDS}`,
      },
    },
  );
}
