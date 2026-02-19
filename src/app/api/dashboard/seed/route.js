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

async function seedImmediately(admin, subCategory) {
  const configured = SEARCH_QUERIES[subCategory];
  const krQuery =
    typeof configured?.KR === 'string' && configured.KR.trim().length > 0
      ? configured.KR
      : subCategory;
  const usQuery =
    typeof configured?.US === 'string' && configured.US.trim().length > 0
      ? configured.US
      : subCategory;

  const [newsKR, newsUS, billsKR, billsUS] = await Promise.all([
    fetchNews(subCategory, 'kr', krQuery),
    fetchNews(subCategory, 'us', usQuery),
    fetchNews(
      subCategory,
      'kr',
      `(${krQuery}) AND (\uBC95\uC548 OR \uADDC\uC81C OR \uC815\uCC45 OR \uC785\uBC95 OR law OR bill OR regulation)`,
    ),
    fetchNews(
      subCategory,
      'us',
      `(${usQuery}) AND (bill OR regulation OR policy OR legislation)`,
    ),
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
    const key = item.url;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  if (deduped.length === 0) {
    return { ok: false, reason: 'no_items' };
  }

  await admin
    .from('raw_items')
    .upsert(deduped, { onConflict: 'url', ignoreDuplicates: true });

  const analysisResult = await analyzeNews(subCategory, deduped, 'mix');
  if (!analysisResult || analysisResult.error) {
    return { ok: false, reason: 'analysis_failed' };
  }

  const payload = {
    country: 'mix',
    sub_category: subCategory,
    score: analysisResult.score,
    label: analysisResult.label,
    comment: analysisResult.comment,
    references: analysisResult.references,
  };

  let { error: insertError } = await admin
    .from('hourly_analysis')
    .insert(payload);

  if (isMissingColumnError(insertError, 'references')) {
    const { references, ...rest } = payload;
    ({ error: insertError } = await admin
      .from('hourly_analysis')
      .insert(rest));
  }

  if (insertError) {
    return { ok: false, reason: insertError.message };
  }

  return { ok: true };
}

export async function POST(request) {
  try {
    if (!hasSupabaseAdminEnv()) {
      return NextResponse.json({ error: 'Admin env not configured.' }, { status: 503 });
    }

    if (!process.env.GOOGLE_GEMINI_KEY) {
      return NextResponse.json({ queued: false, reason: 'missing_key' });
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

    if (existingError && !isMissingTableError(existingError, 'seed_requests')) {
      return NextResponse.json({ queued: false, reason: 'queue_failed', error: existingError.message });
    }

    const seedTableMissing = !!existingError && isMissingTableError(existingError, 'seed_requests');

    if (!seedTableMissing) {
      if (existing?.status === 'processing') {
        return NextResponse.json({ queued: false, reason: 'processing' });
      }

      const nowMs = Date.now();
      const lastRequestedMs = existing?.requested_at ? new Date(existing.requested_at).getTime() : 0;
      if (Number.isFinite(lastRequestedMs) && nowMs - lastRequestedMs < COOLDOWN_MS) {
        return NextResponse.json({ queued: false, reason: 'cooldown' });
      }

      const payload = {
        sub_category: subCategory,
        requested_at: new Date().toISOString(),
        status: 'pending',
        attempts: Number(existing?.attempts ?? 0),
        last_error: null,
      };

      const { error: upsertError } = await admin
        .from('seed_requests')
        .upsert(payload, { onConflict: 'sub_category' });

      if (upsertError) {
        return NextResponse.json({ queued: false, reason: 'queue_failed', error: upsertError.message });
      }

      return NextResponse.json({ queued: true });
    }

    const immediateResult = await seedImmediately(admin, subCategory);
    if (immediateResult.ok) {
      return NextResponse.json({ queued: true, immediate: true });
    }

    return NextResponse.json({ queued: false, reason: immediateResult.reason || 'failed' });
  } catch (error) {
    return NextResponse.json({ error: error?.message ?? 'Failed to queue seed.' }, { status: 500 });
  }
}
