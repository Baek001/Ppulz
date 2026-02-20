export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { CATEGORY_TREE } from '@/lib/constants/categories';
import { normalizeSubCategory } from '@/lib/dashboard/category-normalize';
import { runSeedPipeline } from '@/lib/dashboard/seed-pipeline';

const logs = [];

const DEFAULT_FALLBACK_SUBS = ['주식', '반도체', '주거'];

function parsePositiveInt(value, fallbackValue) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue;
}

const PROCESSING_STALE_MINUTES = parsePositiveInt(
  process.env.DASHBOARD_SEED_PROCESSING_STALE_MINUTES,
  10,
);
const PROCESSING_STALE_MS = PROCESSING_STALE_MINUTES * 60 * 1000;
const MAX_NO_DATA_ATTEMPTS = parsePositiveInt(process.env.DASHBOARD_NO_DATA_MAX_ATTEMPTS, 3);

function log(message) {
  const line = `${new Date().toISOString()}: ${message}`;
  logs.push(line);
  console.log(line);
}

function isCronAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const headerSecret = request.headers.get('x-cron-secret');
  if (headerSecret && headerSecret === cronSecret) {
    return true;
  }

  const { searchParams } = new URL(request.url);
  return searchParams.get('token') === cronSecret;
}

function isMissingTableError(error, tableName) {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  const message = String(error.message || '').toLowerCase();
  return tableName ? message.includes(tableName.toLowerCase()) && message.includes('does not exist') : false;
}

function isConstraintError(error) {
  if (!error) return false;
  return error.code === '23514' || String(error.message || '').toLowerCase().includes('check constraint');
}

function isMissingColumnError(error, columnName) {
  if (!error) return false;
  if (error.code === '42703' || error.code === 'PGRST204') return true;
  return String(error.message || '').toLowerCase().includes(columnName.toLowerCase());
}

function normalizeSubCategoryList(rawList) {
  const set = new Set();
  for (const item of rawList || []) {
    if (typeof item === 'string') {
      const normalized = normalizeSubCategory(item);
      if (normalized) set.add(normalized);
      continue;
    }
    if (item && typeof item === 'object' && typeof item.sub_category === 'string') {
      const normalized = normalizeSubCategory(item.sub_category);
      if (normalized) set.add(normalized);
    }
  }
  return Array.from(set);
}

function allKnownSubCategories() {
  return Object.values(CATEGORY_TREE).flat().map((item) => normalizeSubCategory(item));
}

async function updateSeedStatus(supabase, subCategory, status, options = {}) {
  const nowIso = new Date().toISOString();
  const payload = {
    status,
    requested_at: nowIso,
    last_attempt_at: nowIso,
    last_error: options.lastError ?? null,
  };

  if (Number.isFinite(options.attempts)) {
    payload.attempts = options.attempts;
  }

  let { error } = await supabase.from('seed_requests').update(payload).eq('sub_category', subCategory);

  if (error && isMissingColumnError(error, 'last_attempt_at')) {
    const { last_attempt_at, ...withoutLastAttempt } = payload;
    ({ error } = await supabase
      .from('seed_requests')
      .update(withoutLastAttempt)
      .eq('sub_category', subCategory));
  }

  if (error && status === 'done_no_data' && isConstraintError(error)) {
    const fallbackPayload = {
      ...payload,
      status: 'done',
      last_error: options.lastError ?? 'no_items',
    };
    ({ error } = await supabase.from('seed_requests').update(fallbackPayload).eq('sub_category', subCategory));
  }

  return error || null;
}

async function loadSeedRequests(supabase, limit) {
  let query = supabase
    .from('seed_requests')
    .select('sub_category, attempts, status, requested_at')
    .in('status', ['pending', 'failed', 'processing'])
    .order('requested_at', { ascending: true });

  if (Number.isFinite(limit) && limit > 0) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingTableError(error, 'seed_requests')) {
      log('seed_requests table missing. Queue mode disabled.');
    } else {
      log(`Failed to load seed_requests: ${error.message}`);
    }
    return [];
  }

  const nowMs = Date.now();
  return (data || []).filter((item) => {
    if (item.status !== 'processing') return true;
    if (!item.requested_at) return true;
    const requestedMs = new Date(item.requested_at).getTime();
    if (!Number.isFinite(requestedMs)) return true;
    return nowMs - requestedMs >= PROCESSING_STALE_MS;
  });
}

async function loadSubCategoriesFromOnboarding(supabase, limit) {
  const { data, error } = await supabase
    .from('user_onboarding')
    .select('sub_categories')
    .not('sub_categories', 'is', null);

  if (error) {
    throw new Error(error.message);
  }

  const normalized = normalizeSubCategoryList((data || []).flatMap((row) => row.sub_categories || []));
  if (normalized.length === 0) {
    return DEFAULT_FALLBACK_SUBS;
  }

  if (Number.isFinite(limit) && limit > 0) {
    return normalized.slice(0, limit);
  }

  return normalized;
}

export async function GET(request) {
  log('GET /api/cron/ingest started');

  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return NextResponse.json({ error: 'Missing Supabase admin env' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const limit = parsePositiveInt(
    process.env.INGEST_MAX_SUBS_PER_RUN ?? process.env.INGEST_TARGET_LIMIT,
    0,
  );

  const queueRequests = await loadSeedRequests(supabase, limit);
  const queueMap = new Map(queueRequests.map((item) => [normalizeSubCategory(item.sub_category), item]));
  let targetSubs = queueRequests.map((item) => normalizeSubCategory(item.sub_category)).filter(Boolean);
  let queueMode = targetSubs.length > 0;

  if (!queueMode) {
    try {
      targetSubs = await loadSubCategoriesFromOnboarding(supabase, limit);
    } catch (error) {
      log(`Failed to load onboarding categories: ${error.message}`);
      targetSubs = allKnownSubCategories().slice(0, limit > 0 ? limit : 48);
    }
  }

  const results = [];

  for (const subCategory of targetSubs) {
    const current = queueMap.get(subCategory);
    const nextAttempts = Number(current?.attempts || 0) + 1;

    if (queueMode) {
      const processingError = await updateSeedStatus(supabase, subCategory, 'processing', {
        attempts: nextAttempts,
        lastError: null,
      });
      if (processingError) {
        log(`Failed to mark processing for ${subCategory}: ${processingError.message}`);
      }
    }

    const pipelineResult = await runSeedPipeline(supabase, subCategory);

    if (pipelineResult.ok) {
      results.push({
        category: pipelineResult.canonicalSubCategory,
        analyzed: true,
        count: pipelineResult.itemCount,
        score: pipelineResult.score,
        sourceTier: pipelineResult.sourceTier,
      });

      if (queueMode) {
        const doneError = await updateSeedStatus(supabase, subCategory, 'done', {
          attempts: nextAttempts,
          lastError: null,
        });
        if (doneError) {
          log(`Failed to mark done for ${subCategory}: ${doneError.message}`);
        }
      }
      continue;
    }

    const reason = pipelineResult.reason || 'failed';
    results.push({
      category: pipelineResult.canonicalSubCategory || subCategory,
      analyzed: false,
      count: pipelineResult.itemCount || 0,
      reason,
      sourceTier: pipelineResult.sourceTier || null,
    });

    if (!queueMode) continue;

    if (reason === 'no_items') {
      const status = nextAttempts >= MAX_NO_DATA_ATTEMPTS ? 'done_no_data' : 'failed';
      const statusError = await updateSeedStatus(supabase, subCategory, status, {
        attempts: nextAttempts,
        lastError: reason,
      });
      if (statusError) {
        log(`Failed to mark ${status} for ${subCategory}: ${statusError.message}`);
      }
      continue;
    }

    const failedError = await updateSeedStatus(supabase, subCategory, 'failed', {
      attempts: nextAttempts,
      lastError: reason,
    });
    if (failedError) {
      log(`Failed to mark failed for ${subCategory}: ${failedError.message}`);
    }
  }

  return NextResponse.json({
    success: true,
    queueMode,
    targets: targetSubs.length,
    ingested: results,
    logs,
  });
}

