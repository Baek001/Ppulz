import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient, hasSupabaseAdminEnv } from '@/lib/supabase/admin';
import {
  ensureWalletRow,
  extractSubCategories,
  getMarketAggregate,
  getRecentMarketSnapshots,
  getStakePoints,
  isMarketSchemaMissingError,
  normalizeStatusList,
  toMarketViewModel,
  withMarketSwingAlert,
} from '@/lib/markets/server';

const MARKET_SCHEMA_MISSING_MESSAGE =
  '예측 마켓 테이블이 없습니다. Supabase 마이그레이션 20260219_prediction_market.sql을 실행해주세요.';

export async function GET(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requestedSub = searchParams.get('sub');
  const statusFilter = normalizeStatusList(searchParams.get('status'));
  const stakePoints = getStakePoints();

  const { data: onboarding, error: onboardingError } = await supabase
    .from('user_onboarding')
    .select('sub_categories')
    .eq('user_id', user.id)
    .single();

  if (onboardingError || !onboarding) {
    return NextResponse.json({ error: onboardingError?.message || '온보딩 정보를 찾을 수 없습니다.' }, { status: 404 });
  }

  const allSubCategories = extractSubCategories(onboarding.sub_categories);
  const targetSubCategories = requestedSub
    ? allSubCategories.filter((item) => item === requestedSub)
    : allSubCategories;

  if (targetSubCategories.length === 0) {
    return NextResponse.json({
      stakePoints,
      walletBalance: 0,
      markets: [],
    });
  }

  const useAdmin = hasSupabaseAdminEnv();
  const dbClient = useAdmin ? createAdminClient() : supabase;

  const { data: markets, error: marketsError } = await dbClient
    .from('prediction_markets')
    .select(
      'id, market_key, sub_category, title, description, status, open_at, lock_at, resolve_at, baseline_score, resolved_score, outcome, resolve_rule',
    )
    .in('sub_category', targetSubCategories)
    .in('status', statusFilter)
    .order('resolve_at', { ascending: false })
    .limit(30);

  if (marketsError) {
    if (isMarketSchemaMissingError(marketsError)) {
      return NextResponse.json({ error: MARKET_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    return NextResponse.json({ error: marketsError.message }, { status: 500 });
  }

  let walletBalance = 0;
  if (useAdmin) {
    try {
      walletBalance = await ensureWalletRow(dbClient, user.id);
    } catch (walletError) {
      return NextResponse.json({ error: walletError.message }, { status: 500 });
    }
  } else {
    const { data: wallet } = await supabase
      .from('user_points_wallet')
      .select('balance')
      .eq('user_id', user.id)
      .maybeSingle();
    walletBalance = Number(wallet?.balance) || 0;
  }

  const latestBySubCategory = new Map();
  for (const market of markets || []) {
    if (!latestBySubCategory.has(market.sub_category)) {
      latestBySubCategory.set(market.sub_category, market);
    }
  }
  const latestMarkets = [...latestBySubCategory.values()].sort(
    (a, b) => new Date(a.resolve_at).getTime() - new Date(b.resolve_at).getTime(),
  );

  const marketIds = latestMarkets.map((item) => item.id);

  let aggregateByMarket;
  try {
    aggregateByMarket = await getMarketAggregate(dbClient, marketIds, user.id);
  } catch (aggregateError) {
    return NextResponse.json({ error: aggregateError.message }, { status: 500 });
  }

  let snapshotsByMarket;
  try {
    snapshotsByMarket = await getRecentMarketSnapshots(dbClient, marketIds, 2);
  } catch (snapshotError) {
    if (isMarketSchemaMissingError(snapshotError)) {
      return NextResponse.json({ error: MARKET_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    return NextResponse.json({ error: snapshotError.message }, { status: 500 });
  }

  const marketViews = latestMarkets.map((market) => {
    const aggregate = aggregateByMarket.get(market.id);
    const marketView = toMarketViewModel(market, aggregate);
    return withMarketSwingAlert(marketView, snapshotsByMarket.get(market.id));
  });

  return NextResponse.json({
    stakePoints,
    walletBalance,
    markets: marketViews,
  });
}
