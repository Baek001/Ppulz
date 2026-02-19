export const runtime = 'edge';
import { NextResponse } from 'next/server';

import { CATEGORY_TREE } from '@/lib/constants/categories';
import {
  ensureWalletRow,
  getMarketAggregate,
  getRecentMarketSnapshots,
  getStakePoints,
  isMarketSchemaMissingError,
  toMarketViewModel,
  withMarketSwingAlert,
} from '@/lib/markets/server';
import { buildSubToBigMap, fetchTopSubCategoriesForBoard } from '@/lib/markets/targets';
import { createAdminClient, hasSupabaseAdminEnv } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const MARKET_SCHEMA_MISSING_MESSAGE =
  '?덉륫 留덉폆 ?뚯씠釉붿씠 ?놁뒿?덈떎. Supabase 留덉씠洹몃젅?댁뀡 20260219_prediction_market.sql???ㅽ뻾?댁＜?몄슂.';
const MARKET_BOARD_ADMIN_REQUIRED_MESSAGE =
  '留덉폆 蹂대뱶 議고쉶瑜??꾪빐 Supabase ?쒕퉬??濡??ㅺ? ?꾩슂?⑸땲??';

export async function GET() {
  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: MARKET_BOARD_ADMIN_REQUIRED_MESSAGE }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();

  let targetSummary;
  try {
    targetSummary = await fetchTopSubCategoriesForBoard(admin);
  } catch (error) {
    if (isMarketSchemaMissingError(error)) {
      return NextResponse.json({ error: MARKET_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const selectedSubCategories = targetSummary.selectedSubCategories;
  const categories = [];
  const markets = [];

  if (selectedSubCategories.length === 0) {
    Object.keys(CATEGORY_TREE).forEach((bigCategory) => {
      categories.push({ bigCategory, markets: [] });
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      stakePoints: getStakePoints(),
      isAuthenticated: !!user?.id,
      walletBalance: 0,
      categories,
      markets,
    });
  }

  const { data: marketRows, error: marketsError } = await admin
    .from('prediction_markets')
    .select(
      'id, market_key, sub_category, title, description, status, open_at, lock_at, resolve_at, baseline_score, resolved_score, outcome, resolve_rule',
    )
    .in('sub_category', selectedSubCategories)
    .in('status', ['open', 'locked'])
    .order('resolve_at', { ascending: false })
    .limit(300);

  if (marketsError) {
    if (isMarketSchemaMissingError(marketsError)) {
      return NextResponse.json({ error: MARKET_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    return NextResponse.json({ error: marketsError.message }, { status: 500 });
  }

  const latestBySubCategory = new Map();
  for (const market of marketRows || []) {
    if (!latestBySubCategory.has(market.sub_category)) {
      latestBySubCategory.set(market.sub_category, market);
    }
  }

  const marketIds = [...latestBySubCategory.values()].map((item) => item.id);

  let aggregateByMarket;
  try {
    aggregateByMarket = await getMarketAggregate(admin, marketIds, user?.id || null);
  } catch (aggregateError) {
    return NextResponse.json({ error: aggregateError.message }, { status: 500 });
  }

  let snapshotsByMarket;
  try {
    snapshotsByMarket = await getRecentMarketSnapshots(admin, marketIds, 2);
  } catch (snapshotError) {
    if (isMarketSchemaMissingError(snapshotError)) {
      return NextResponse.json({ error: MARKET_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    return NextResponse.json({ error: snapshotError.message }, { status: 500 });
  }

  let walletBalance = 0;
  if (user?.id) {
    try {
      walletBalance = await ensureWalletRow(admin, user.id);
    } catch (walletError) {
      if (isMarketSchemaMissingError(walletError)) {
        return NextResponse.json({ error: MARKET_SCHEMA_MISSING_MESSAGE }, { status: 503 });
      }
      return NextResponse.json({ error: walletError.message }, { status: 500 });
    }
  }

  const subToBig = buildSubToBigMap();

  Object.keys(CATEGORY_TREE).forEach((bigCategory) => {
    const pickedSubs = targetSummary.selectionByBig.get(bigCategory) || [];
    const mappedMarkets = pickedSubs
      .map((subCategory) => latestBySubCategory.get(subCategory))
      .filter(Boolean)
      .map((market) => {
        const aggregate = aggregateByMarket.get(market.id);
        const view = withMarketSwingAlert(
          toMarketViewModel(market, aggregate),
          snapshotsByMarket.get(market.id),
        );
        return {
          ...view,
          bigCategory: subToBig.get(view.subCategory) || '',
        };
      });

    categories.push({
      bigCategory,
      markets: mappedMarkets,
    });
    markets.push(...mappedMarkets);
  });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    stakePoints: getStakePoints(),
    isAuthenticated: !!user?.id,
    walletBalance,
    categories,
    markets,
  });
}

