export const runtime = 'edge';
import { NextResponse } from 'next/server';

import { resolveDueMarkets } from '@/lib/markets/resolve';
import { isMarketSchemaMissingError } from '@/lib/markets/server';
import { createAdminClient, hasSupabaseAdminEnv } from '@/lib/supabase/admin';

const MARKET_SCHEMA_MISSING_MESSAGE =
  '?덉륫 留덉폆 ?뚯씠釉붿씠 ?놁뒿?덈떎. Supabase 留덉씠洹몃젅?댁뀡 20260219_prediction_market.sql???ㅽ뻾?댁＜?몄슂.';

function isCronAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const secretFromHeader = request.headers.get('x-cron-secret');
  if (secretFromHeader && secretFromHeader === cronSecret) {
    return true;
  }

  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    return token === cronSecret;
  }

  return false;
}

async function handleResolve(request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: '?몄쬆?섏? ?딆? ?붿껌?낅땲??' }, { status: 401 });
  }

  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: '?쒕퉬??濡??섍꼍 蹂?섍? ?놁뒿?덈떎.' }, { status: 500 });
  }

  const admin = createAdminClient();

  let summary;
  try {
    summary = await resolveDueMarkets(admin, { limit: 50 });
  } catch (error) {
    if (isMarketSchemaMissingError(error)) {
      return NextResponse.json({ error: MARKET_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    return NextResponse.json({ error: error?.message || '?뺤궛 泥섎━???ㅽ뙣?덉뒿?덈떎.' }, { status: 500 });
  }

  const normalizedResults = (summary.results || []).map((item) => {
    if (item.ok) return item;
    const schemaMissing = isMarketSchemaMissingError({ message: item.error });
    return {
      ...item,
      error: schemaMissing ? MARKET_SCHEMA_MISSING_MESSAGE : item.error,
    };
  });

  return NextResponse.json({
    ok: true,
    resolvedCount: summary.resolvedCount,
    failedCount: summary.failedCount,
    results: normalizedResults,
  });
}

export async function POST(request) {
  return handleResolve(request);
}

export async function GET(request) {
  return handleResolve(request);
}

