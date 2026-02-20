export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient, hasSupabaseAdminEnv } from '@/lib/supabase/admin';
import { normalizeSubCategory } from '@/lib/dashboard/category-normalize';
import { runSeedPipeline } from '@/lib/dashboard/seed-pipeline';

const requestSchema = z.object({
  subCategory: z.string().min(1),
});

function parsePositiveInt(value, fallbackValue) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue;
}

const COOLDOWN_MINUTES = parsePositiveInt(process.env.DASHBOARD_SEED_COOLDOWN_MINUTES, 10);
const COOLDOWN_MS = COOLDOWN_MINUTES * 60 * 1000;
const PROCESSING_STALE_MINUTES = parsePositiveInt(
  process.env.DASHBOARD_SEED_PROCESSING_STALE_MINUTES,
  5,
);
const PROCESSING_STALE_MS = PROCESSING_STALE_MINUTES * 60 * 1000;

function isMissingTableError(error, tableName) {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  const message = String(error.message || '').toLowerCase();
  return tableName ? message.includes(tableName.toLowerCase()) && message.includes('does not exist') : false;
}

function isMissingColumnError(error, columnName) {
  if (!error) return false;
  if (error.code === '42703' || error.code === 'PGRST204') return true;
  return String(error.message || '').toLowerCase().includes(columnName.toLowerCase());
}

async function upsertSeedStatus(admin, payload) {
  let { error } = await admin.from('seed_requests').upsert(payload, { onConflict: 'sub_category' });
  if (!error) return null;

  if (isMissingColumnError(error, 'last_attempt_at')) {
    const { last_attempt_at, ...fallbackPayload } = payload;
    ({ error } = await admin.from('seed_requests').upsert(fallbackPayload, { onConflict: 'sub_category' }));
  }

  return error || null;
}

async function updateSeedStatus(admin, subCategory, status, attempts, lastError = null) {
  const payload = {
    sub_category: subCategory,
    requested_at: new Date().toISOString(),
    last_attempt_at: new Date().toISOString(),
    status,
    attempts,
    last_error: lastError,
  };
  return upsertSeedStatus(admin, payload);
}

export async function GET() {
  try {
    if (!hasSupabaseAdminEnv()) {
      return NextResponse.json(
        { ok: false, error: 'Admin env not configured.', reason: 'missing_admin_env' },
        { status: 503 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ ok: true, route: 'seed', version: 2 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? 'Seed route check failed.' },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    if (!hasSupabaseAdminEnv()) {
      return NextResponse.json(
        { error: 'Admin env not configured.', reason: 'missing_admin_env' },
        { status: 503 },
      );
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

    const requestedSubCategory = parsed.data.subCategory;
    const canonicalSubCategory = normalizeSubCategory(requestedSubCategory);
    if (!canonicalSubCategory) {
      return NextResponse.json({ error: 'Invalid subCategory' }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: existing, error: existingError } = await admin
      .from('seed_requests')
      .select('status, requested_at, attempts')
      .eq('sub_category', canonicalSubCategory)
      .maybeSingle();

    const queueUnavailable = isMissingTableError(existingError, 'seed_requests');
    if (existingError && !queueUnavailable) {
      return NextResponse.json({
        queued: false,
        reason: 'queue_failed',
        error: existingError.message,
      });
    }

    const nowMs = Date.now();
    const lastRequestedMs = existing?.requested_at ? new Date(existing.requested_at).getTime() : 0;
    const processingFresh =
      existing?.status === 'processing' &&
      Number.isFinite(lastRequestedMs) &&
      nowMs - lastRequestedMs < PROCESSING_STALE_MS;

    if (!queueUnavailable && processingFresh) {
      return NextResponse.json({
        queued: false,
        reason: 'processing',
        status: 'processing',
        subCategory: canonicalSubCategory,
      });
    }

    if (!queueUnavailable && Number.isFinite(lastRequestedMs) && nowMs - lastRequestedMs < COOLDOWN_MS) {
      return NextResponse.json({
        queued: false,
        reason: 'cooldown',
        status: existing?.status || null,
        subCategory: canonicalSubCategory,
      });
    }

    const nextAttempts = Number(existing?.attempts || 0) + 1;

    if (!queueUnavailable) {
      const processingError = await updateSeedStatus(
        admin,
        canonicalSubCategory,
        'processing',
        nextAttempts,
        null,
      );
      if (processingError) {
        return NextResponse.json({
          queued: false,
          reason: 'queue_failed',
          error: processingError.message,
        });
      }
    }

    const immediateResult = await runSeedPipeline(admin, canonicalSubCategory);
    if (immediateResult.ok) {
      if (!queueUnavailable) {
        await updateSeedStatus(admin, canonicalSubCategory, 'done', nextAttempts, null);
      }
      return NextResponse.json({
        queued: true,
        immediate: true,
        status: 'done',
        sourceTier: immediateResult.sourceTier || 'category',
        subCategory: canonicalSubCategory,
      });
    }

    if (!queueUnavailable) {
      const fallbackStatus = 'pending';
      await updateSeedStatus(
        admin,
        canonicalSubCategory,
        fallbackStatus,
        nextAttempts,
        immediateResult.reason || 'failed',
      );
      return NextResponse.json({
        queued: true,
        immediate: false,
        reason: 'queued_retry',
        status: fallbackStatus,
        subCategory: canonicalSubCategory,
      });
    }

    return NextResponse.json({
      queued: false,
      reason: immediateResult.reason || 'failed',
      status: immediateResult.reason === 'no_items' ? 'done_no_data' : 'failed',
      subCategory: canonicalSubCategory,
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message ?? 'Failed to queue seed.' }, { status: 500 });
  }
}
