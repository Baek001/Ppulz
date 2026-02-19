export const runtime = 'edge';
import { NextResponse } from 'next/server';

import { ensureOpenMarketsForSubCategories } from '@/lib/markets/open';
import { resolveDueMarkets } from '@/lib/markets/resolve';
import { isMarketSchemaMissingError } from '@/lib/markets/server';
import {
  fetchTopSubCategoriesForBoard,
  DEFAULT_LOOKBACK_HOURS,
  DEFAULT_PER_BIG_CATEGORY_LIMIT,
} from '@/lib/markets/targets';
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

async function handleRollover(request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: '?몄쬆?섏? ?딆? ?붿껌?낅땲??' }, { status: 401 });
  }

  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: '?쒕퉬??濡??섍꼍 蹂?섍? ?놁뒿?덈떎.' }, { status: 500 });
  }

  const admin = createAdminClient();

  let resolveSummary;
  try {
    resolveSummary = await resolveDueMarkets(admin, { limit: 100 });
  } catch (error) {
    if (isMarketSchemaMissingError(error)) {
      return NextResponse.json({ error: MARKET_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    return NextResponse.json({ error: error?.message || '留덉폆 ?뺤궛 ?묒뾽???ㅽ뙣?덉뒿?덈떎.' }, { status: 500 });
  }

  let targetSummary;
  try {
    targetSummary = await fetchTopSubCategoriesForBoard(admin, {
      lookbackHours: DEFAULT_LOOKBACK_HOURS,
      perBigCategoryLimit: DEFAULT_PER_BIG_CATEGORY_LIMIT,
    });
  } catch (error) {
    if (isMarketSchemaMissingError(error)) {
      return NextResponse.json({ error: MARKET_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    return NextResponse.json({ error: error?.message || '留덉폆 ????좎젙???ㅽ뙣?덉뒿?덈떎.' }, { status: 500 });
  }

  let openSummary;
  try {
    openSummary = await ensureOpenMarketsForSubCategories(admin, targetSummary.selectedSubCategories);
  } catch (error) {
    if (isMarketSchemaMissingError(error)) {
      return NextResponse.json({ error: MARKET_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    return NextResponse.json({ error: error?.message || '留덉폆 ?ㅽ뵂 蹂댁옣 ?묒뾽???ㅽ뙣?덉뒿?덈떎.' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    lookbackHours: DEFAULT_LOOKBACK_HOURS,
    perBigCategoryLimit: DEFAULT_PER_BIG_CATEGORY_LIMIT,
    targetSubCategories: targetSummary.selectedSubCategories,
    selectionByBigCategory: [...targetSummary.selectionByBig.entries()].map(([bigCategory, subCategories]) => ({
      bigCategory,
      subCategories,
    })),
    resolvedCount: resolveSummary.resolvedCount,
    resolveFailedCount: resolveSummary.failedCount,
    resolveResults: resolveSummary.results,
    openedCount: openSummary.openedCount,
    openedSubCategories: openSummary.openedSubCategories,
  });
}

export async function POST(request) {
  return handleRollover(request);
}

export async function GET(request) {
  return handleRollover(request);
}

