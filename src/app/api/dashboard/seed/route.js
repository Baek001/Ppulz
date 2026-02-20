export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient, hasSupabaseAdminEnv } from '@/lib/supabase/admin';
import { SEARCH_QUERIES } from '@/lib/constants/search_queries';
import { fetchNews } from '@/lib/ingest/news';
import { analyzeNews } from '@/lib/analysis/gemini';

const requestSchema = z.object({
  subCategory: z.string().min(1),
});

function parsePositiveInt(value, fallbackValue) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue;
}

const COOLDOWN_MINUTES = parsePositiveInt(process.env.DASHBOARD_SEED_COOLDOWN_MINUTES, 10);
const COOLDOWN_MS = COOLDOWN_MINUTES * 60 * 1000;

function isMissingTableError(error, tableName) {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  const message = String(error.message || '').toLowerCase();
  return tableName ? message.includes(tableName.toLowerCase()) && message.includes('does not exist') : false;
}

function isMissingColumnError(error, columnName) {
  if (!error) return false;
  if (error.code === '42703') return true;
  return String(error.message || '').toLowerCase().includes(columnName.toLowerCase());
}

function normalizeRawItems(items, subCategory, sourceType, fallbackCountry) {
  return (items || [])
    .filter((item) => item?.title && item?.url)
    .map((item) => ({
      source_type: sourceType,
      country: item.country || fallbackCountry,
      category: subCategory,
      title: item.title,
      snippet: item.snippet || '',
      url: item.url,
      published_at: item.published_at || new Date().toISOString(),
    }));
}

async function fetchNewsWithFallbacks(subCategory, country, queries) {
  for (const query of queries) {
    if (!query || typeof query !== 'string') continue;
    const rows = await fetchNews(subCategory, country, query);
    if (Array.isArray(rows) && rows.length > 0) {
      return rows;
    }
  }
  return [];
}

async function loadRecentFallbackItems(admin, subCategory) {
  const byCategory = await admin
    .from('raw_items')
    .select('source_type, country, title, snippet, url, published_at')
    .in('source_type', ['news', 'bill'])
    .ilike('category', `%${subCategory}%`)
    .order('published_at', { ascending: false })
    .limit(20);

  let rows = byCategory.data || [];
  if (!rows.length) {
    const recent = await admin
      .from('raw_items')
      .select('source_type, country, title, snippet, url, published_at')
      .in('source_type', ['news', 'bill'])
      .order('published_at', { ascending: false })
      .limit(30);
    rows = recent.data || [];
  }

  return rows
    .filter((item) => item?.title && item?.url && item?.source_type)
    .map((item) => ({
      source_type: item.source_type,
      country: item.country || 'kr',
      category: subCategory,
      title: item.title,
      snippet: item.snippet || '',
      url: item.url,
      published_at: item.published_at || new Date().toISOString(),
    }));
}

async function ensureMinimumGraphPoints(admin, subCategory, latestRow, minimumPoints = 3) {
  const { data: existingRows } = await admin
    .from('hourly_analysis')
    .select('id, analyzed_at')
    .eq('country', 'mix')
    .eq('sub_category', subCategory)
    .order('analyzed_at', { ascending: false })
    .limit(minimumPoints);

  const currentCount = (existingRows || []).length;
  if (currentCount >= minimumPoints) return;

  const missing = minimumPoints - currentCount;
  const inserts = [];
  for (let i = missing; i >= 1; i -= 1) {
    inserts.push({
      ...latestRow,
      analyzed_at: new Date(Date.now() - i * 60 * 60 * 1000).toISOString(),
    });
  }

  if (inserts.length > 0) {
    await admin.from('hourly_analysis').insert(inserts);
  }
}

async function seedImmediately(admin, subCategory) {
  const configured = SEARCH_QUERIES[subCategory];
  const krQuery = typeof configured?.KR === 'string' && configured.KR.trim() ? configured.KR : subCategory;
  const usQuery = typeof configured?.US === 'string' && configured.US.trim() ? configured.US : subCategory;

  const krNewsQueries = [
    krQuery,
    `${subCategory} 뉴스`,
    `${subCategory} 시장`,
    '한국 경제 뉴스',
  ];
  const usNewsQueries = [
    usQuery,
    `${subCategory} market news`,
    `${subCategory} economy`,
    'US economy news',
  ];
  const krBillQueries = [
    `(${krQuery}) AND (법안 OR 규제 OR 정책 OR 입법)`,
    `${subCategory} 법안`,
    `${subCategory} 규제`,
    '한국 규제 정책',
  ];
  const usBillQueries = [
    `(${usQuery}) AND (bill OR regulation OR policy OR legislation)`,
    `${subCategory} bill`,
    `${subCategory} regulation`,
    'US regulation policy',
  ];

  const [newsKR, newsUS, billsKR, billsUS] = await Promise.all([
    fetchNewsWithFallbacks(subCategory, 'kr', krNewsQueries),
    fetchNewsWithFallbacks(subCategory, 'us', usNewsQueries),
    fetchNewsWithFallbacks(subCategory, 'kr', krBillQueries),
    fetchNewsWithFallbacks(subCategory, 'us', usBillQueries),
  ]);

  const combined = [
    ...normalizeRawItems(newsKR, subCategory, 'news', 'kr'),
    ...normalizeRawItems(newsUS, subCategory, 'news', 'us'),
    ...normalizeRawItems(billsKR, subCategory, 'bill', 'kr'),
    ...normalizeRawItems(billsUS, subCategory, 'bill', 'us'),
  ];

  const deduped = [];
  const seen = new Set();
  for (const item of combined) {
    if (!item.url || seen.has(item.url)) continue;
    seen.add(item.url);
    deduped.push(item);
  }

  if (deduped.length === 0) {
    const [fallbackKR, fallbackUS] = await Promise.all([
      fetchNewsWithFallbacks(subCategory, 'kr', ['한국 경제 뉴스', '한국 정책 뉴스']),
      fetchNewsWithFallbacks(subCategory, 'us', ['US economy news', 'US policy news']),
    ]);
    const fallbackRows = [
      ...normalizeRawItems(fallbackKR, subCategory, 'news', 'kr'),
      ...normalizeRawItems(fallbackUS, subCategory, 'news', 'us'),
    ];
    for (const item of fallbackRows) {
      if (!item.url || seen.has(item.url)) continue;
      seen.add(item.url);
      deduped.push(item);
    }
  }

  if (deduped.length === 0) {
    const dbFallback = await loadRecentFallbackItems(admin, subCategory);
    for (const item of dbFallback) {
      if (!item.url || seen.has(item.url)) continue;
      seen.add(item.url);
      deduped.push(item);
    }
  }

  if (deduped.length === 0) {
    return { ok: false, reason: 'no_items' };
  }

  await admin.from('raw_items').upsert(deduped, { onConflict: 'url', ignoreDuplicates: true });

  const analysisResult = await analyzeNews(subCategory, deduped, 'mix');
  if (!analysisResult || analysisResult.error) {
    return { ok: false, reason: analysisResult?.error || 'analysis_failed' };
  }

  const payload = {
    country: 'mix',
    sub_category: subCategory,
    score: analysisResult.score,
    label: analysisResult.label,
    comment: analysisResult.comment,
    references: analysisResult.references,
  };

  let { error: insertError } = await admin.from('hourly_analysis').insert(payload);
  if (isMissingColumnError(insertError, 'references')) {
    const { references, ...rest } = payload;
    ({ error: insertError } = await admin.from('hourly_analysis').insert(rest));
  }

  if (insertError) {
    return { ok: false, reason: insertError.message };
  }

  await ensureMinimumGraphPoints(admin, subCategory, payload, 3);

  return { ok: true };
}

async function updateSeedStatus(admin, subCategory, status, attempts, lastError = null) {
  const payload = {
    sub_category: subCategory,
    requested_at: new Date().toISOString(),
    status,
    attempts,
    last_error: lastError,
  };
  return admin.from('seed_requests').upsert(payload, { onConflict: 'sub_category' });
}

export async function POST(request) {
  try {
    if (!hasSupabaseAdminEnv()) {
      return NextResponse.json({ error: 'Admin env not configured.' }, { status: 503 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const subCategory = parsed.data.subCategory;
    const admin = createAdminClient();

    const { data: existing, error: existingError } = await admin
      .from('seed_requests')
      .select('status, requested_at, attempts')
      .eq('sub_category', subCategory)
      .maybeSingle();

    const queueUnavailable = isMissingTableError(existingError, 'seed_requests');
    if (existingError && !queueUnavailable) {
      return NextResponse.json({ queued: false, reason: 'queue_failed', error: existingError.message });
    }

    if (!queueUnavailable && existing?.status === 'processing') {
      return NextResponse.json({ queued: false, reason: 'processing' });
    }

    const nowMs = Date.now();
    const lastRequestedMs = existing?.requested_at ? new Date(existing.requested_at).getTime() : 0;
    if (!queueUnavailable && Number.isFinite(lastRequestedMs) && nowMs - lastRequestedMs < COOLDOWN_MS) {
      return NextResponse.json({ queued: false, reason: 'cooldown' });
    }

    const nextAttempts = Number(existing?.attempts || 0) + 1;

    if (!queueUnavailable) {
      const { error: processingError } = await updateSeedStatus(
        admin,
        subCategory,
        'processing',
        nextAttempts,
        null,
      );
      if (processingError) {
        return NextResponse.json({ queued: false, reason: 'queue_failed', error: processingError.message });
      }
    }

    const immediateResult = await seedImmediately(admin, subCategory);
    if (immediateResult.ok) {
      if (!queueUnavailable) {
        await updateSeedStatus(admin, subCategory, 'done', nextAttempts, null);
      }
      return NextResponse.json({ queued: true, immediate: true });
    }

    // Immediate attempt failed, keep it queued for cron retry.
    if (!queueUnavailable) {
      await updateSeedStatus(admin, subCategory, 'pending', nextAttempts, immediateResult.reason || 'failed');
      return NextResponse.json({ queued: true, immediate: false, reason: 'queued_retry' });
    }

    return NextResponse.json({ queued: false, reason: immediateResult.reason || 'failed' });
  } catch (error) {
    return NextResponse.json({ error: error?.message ?? 'Failed to queue seed.' }, { status: 500 });
  }
}
