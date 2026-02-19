export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient, hasSupabaseAdminEnv } from '@/lib/supabase/admin';

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

    if (existingError) {
      if (isMissingTableError(existingError, 'seed_requests')) {
        return NextResponse.json(
          { error: 'seed_requests table missing.' },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

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
      return NextResponse.json({ queued: false, error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ queued: true });
  } catch (error) {
    return NextResponse.json({ error: error?.message ?? 'Failed to queue seed.' }, { status: 500 });
  }
}
