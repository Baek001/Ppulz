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
  '예측 마켓 테이블이 없습니다. Supabase 마이그레이션 20260219_prediction_market.sql을 실행해주세요.';

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
    return NextResponse.json({ error: '인증되지 않은 요청입니다.' }, { status: 401 });
  }

  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: '서비스 롤 환경 변수가 없습니다.' }, { status: 500 });
  }

  const admin = createAdminClient();

  let resolveSummary;
  try {
    resolveSummary = await resolveDueMarkets(admin, { limit: 100 });
  } catch (error) {
    if (isMarketSchemaMissingError(error)) {
      return NextResponse.json({ error: MARKET_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    return NextResponse.json({ error: error?.message || '마켓 정산 작업에 실패했습니다.' }, { status: 500 });
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
    return NextResponse.json({ error: error?.message || '마켓 대상 선정에 실패했습니다.' }, { status: 500 });
  }

  let openSummary;
  try {
    openSummary = await ensureOpenMarketsForSubCategories(admin, targetSummary.selectedSubCategories);
  } catch (error) {
    if (isMarketSchemaMissingError(error)) {
      return NextResponse.json({ error: MARKET_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    return NextResponse.json({ error: error?.message || '마켓 오픈 보장 작업에 실패했습니다.' }, { status: 500 });
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
