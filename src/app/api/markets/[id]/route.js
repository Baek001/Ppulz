import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient, hasSupabaseAdminEnv } from '@/lib/supabase/admin';
import {
  ensureWalletRow,
  getMarketAggregate,
  getStakePoints,
  isMarketSchemaMissingError,
  toMarketViewModel,
  withMarketSwingAlert,
} from '@/lib/markets/server';

const MARKET_SCHEMA_MISSING_MESSAGE =
  '예측 마켓 테이블이 없습니다. Supabase 마이그레이션 20260219_prediction_market.sql을 실행해주세요.';

export async function GET(_request, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  const stakePoints = getStakePoints();
  const useAdmin = hasSupabaseAdminEnv();
  const dbClient = useAdmin ? createAdminClient() : supabase;

  const { data: market, error: marketError } = await dbClient
    .from('prediction_markets')
    .select(
      'id, market_key, sub_category, title, description, status, open_at, lock_at, resolve_at, baseline_score, resolved_score, outcome, resolve_rule',
    )
    .eq('id', id)
    .maybeSingle();

  if (marketError) {
    if (isMarketSchemaMissingError(marketError)) {
      return NextResponse.json({ error: MARKET_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    return NextResponse.json({ error: marketError.message }, { status: 500 });
  }

  if (!market) {
    return NextResponse.json({ error: '마켓을 찾을 수 없습니다.' }, { status: 404 });
  }

  let walletBalance = 0;
  if (useAdmin) {
    try {
      walletBalance = await ensureWalletRow(dbClient, user.id);
    } catch (walletError) {
      if (isMarketSchemaMissingError(walletError)) {
        return NextResponse.json({ error: MARKET_SCHEMA_MISSING_MESSAGE }, { status: 503 });
      }
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

  let aggregateByMarket;
  try {
    aggregateByMarket = await getMarketAggregate(dbClient, [market.id], user.id);
  } catch (aggregateError) {
    if (isMarketSchemaMissingError(aggregateError)) {
      return NextResponse.json({ error: MARKET_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    return NextResponse.json({ error: aggregateError.message }, { status: 500 });
  }

  const marketViewBase = toMarketViewModel(market, aggregateByMarket.get(market.id));

  const { data: recentSeries } = await dbClient
    .from('hourly_analysis')
    .select('analyzed_at, score, label, comment')
    .in('country', ['mix', 'kr', 'us'])
    .eq('sub_category', market.sub_category)
    .order('analyzed_at', { ascending: false })
    .limit(12);

  const { data: snapshots } = await dbClient
    .from('prediction_market_snapshots')
    .select('snapshot_at, up_count, down_count, up_points, down_points')
    .eq('market_id', market.id)
    .order('snapshot_at', { ascending: false })
    .limit(20);

  const marketView = withMarketSwingAlert(marketViewBase, snapshots || []);

  return NextResponse.json({
    stakePoints,
    walletBalance,
    market: marketView,
    recentSeries: (recentSeries || []).reverse(),
    snapshots: (snapshots || []).reverse(),
  });
}
