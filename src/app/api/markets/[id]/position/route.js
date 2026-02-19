import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient, hasSupabaseAdminEnv } from '@/lib/supabase/admin';
import {
  appendLedgerRow,
  ensureWalletRow,
  getMarketAggregate,
  getRecentMarketSnapshots,
  getStakePoints,
  isMarketSchemaMissingError,
  normalizeSide,
  toMarketViewModel,
  withMarketSwingAlert,
} from '@/lib/markets/server';

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MARKET_SCHEMA_MISSING_MESSAGE =
  '예측 마켓 테이블이 없습니다. Supabase 마이그레이션 20260219_prediction_market.sql을 실행해주세요.';
const positionRequestHistory = new Map();

function isRateLimited(userId) {
  const now = Date.now();
  const timestamps = positionRequestHistory.get(userId) || [];
  const active = timestamps.filter((value) => now - value < RATE_LIMIT_WINDOW_MS);

  if (active.length >= RATE_LIMIT_MAX) {
    positionRequestHistory.set(userId, active);
    return true;
  }

  active.push(now);
  positionRequestHistory.set(userId, active);
  return false;
}

export async function POST(request, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json(
      { error: '마켓 참여 처리를 위해 Supabase 서비스 롤 키가 필요합니다.' },
      { status: 500 },
    );
  }

  if (isRateLimited(user.id)) {
    return NextResponse.json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다.' }, { status: 400 });
  }

  const side = normalizeSide(body?.side);
  if (!side) {
    return NextResponse.json({ error: 'side 값은 "up" 또는 "down"이어야 합니다.' }, { status: 400 });
  }

  const stakePoints = getStakePoints();
  const admin = createAdminClient();

  const { data: market, error: marketError } = await admin
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

  const lockAtMs = new Date(market.lock_at || market.resolve_at).getTime();
  if (market.status !== 'open' || (Number.isFinite(lockAtMs) && lockAtMs <= Date.now())) {
    return NextResponse.json({ error: '이미 마감된 마켓입니다.' }, { status: 400 });
  }

  const { data: existing } = await admin
    .from('prediction_positions')
    .select('id, side, stake_points')
    .eq('market_id', market.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing && existing.side !== side) {
    return NextResponse.json(
      {
        error: `이미 ${existing.side === 'up' ? '상승' : '하락'} 방향으로 참여했습니다. 같은 방향으로만 추가 배팅할 수 있습니다.`,
        myPosition: existing.side,
      },
      { status: 409 },
    );
  }

  let walletBalance;
  try {
    walletBalance = await ensureWalletRow(admin, user.id);
  } catch (walletError) {
    if (isMarketSchemaMissingError(walletError)) {
      return NextResponse.json({ error: MARKET_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    return NextResponse.json({ error: walletError.message }, { status: 500 });
  }

  if (walletBalance < stakePoints) {
    return NextResponse.json({ error: '포인트가 부족합니다.' }, { status: 400 });
  }

  const nextBalance = walletBalance - stakePoints;

  const { error: walletUpdateError } = await admin
    .from('user_points_wallet')
    .update({ balance: nextBalance })
    .eq('user_id', user.id);

  if (walletUpdateError) {
    if (isMarketSchemaMissingError(walletUpdateError)) {
      return NextResponse.json({ error: MARKET_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    return NextResponse.json({ error: walletUpdateError.message }, { status: 500 });
  }

  let nextStakePoints = stakePoints;
  if (existing) {
    nextStakePoints = (Number(existing.stake_points) || 0) + stakePoints;
    const { error: updatePositionError } = await admin
      .from('prediction_positions')
      .update({ stake_points: nextStakePoints })
      .eq('id', existing.id)
      .eq('user_id', user.id);

    if (updatePositionError) {
      await admin
        .from('user_points_wallet')
        .update({ balance: walletBalance })
        .eq('user_id', user.id);

      if (isMarketSchemaMissingError(updatePositionError)) {
        return NextResponse.json({ error: MARKET_SCHEMA_MISSING_MESSAGE }, { status: 503 });
      }
      return NextResponse.json({ error: updatePositionError.message }, { status: 500 });
    }
  } else {
    const { error: positionError } = await admin
      .from('prediction_positions')
      .insert({
        market_id: market.id,
        user_id: user.id,
        side,
        stake_points: stakePoints,
      });

    if (positionError) {
      await admin
        .from('user_points_wallet')
        .update({ balance: walletBalance })
        .eq('user_id', user.id);

      if (isMarketSchemaMissingError(positionError)) {
        return NextResponse.json({ error: MARKET_SCHEMA_MISSING_MESSAGE }, { status: 503 });
      }

      const duplicate = positionError.code === '23505';
      return NextResponse.json(
        {
          error: duplicate ? '이미 참여한 마켓입니다.' : positionError.message,
        },
        { status: duplicate ? 409 : 500 },
      );
    }
  }

  try {
    await appendLedgerRow(admin, {
      userId: user.id,
      type: 'stake_lock',
      delta: -stakePoints,
      balanceAfter: nextBalance,
      refType: 'market',
      refId: market.id,
      meta: { side, mode: existing ? 'add' : 'new' },
    });
  } catch (ledgerError) {
    if (isMarketSchemaMissingError(ledgerError)) {
      return NextResponse.json({ error: MARKET_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    return NextResponse.json({ error: ledgerError.message }, { status: 500 });
  }

  let aggregateByMarket;
  try {
    aggregateByMarket = await getMarketAggregate(admin, [market.id], user.id);
  } catch (aggregateError) {
    if (isMarketSchemaMissingError(aggregateError)) {
      return NextResponse.json({ error: MARKET_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    return NextResponse.json({ error: aggregateError.message }, { status: 500 });
  }

  const marketView = toMarketViewModel(market, aggregateByMarket.get(market.id));
  const crowd = marketView.crowd;

  let snapshotRows = [];
  try {
    const snapshotsByMarket = await getRecentMarketSnapshots(admin, [market.id], 1);
    snapshotRows = snapshotsByMarket.get(market.id) || [];
  } catch (snapshotQueryError) {
    if (isMarketSchemaMissingError(snapshotQueryError)) {
      return NextResponse.json({ error: MARKET_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    return NextResponse.json({ error: snapshotQueryError.message }, { status: 500 });
  }

  const marketViewWithSwing = withMarketSwingAlert(marketView, snapshotRows);

  const { error: snapshotError } = await admin
    .from('prediction_market_snapshots')
    .insert({
      market_id: market.id,
      up_count: crowd.upCount,
      down_count: crowd.downCount,
      up_points: crowd.upPoints,
      down_points: crowd.downPoints,
    });

  if (snapshotError && !isMarketSchemaMissingError(snapshotError)) {
    return NextResponse.json({ error: snapshotError.message }, { status: 500 });
  }

  if (snapshotError && isMarketSchemaMissingError(snapshotError)) {
    return NextResponse.json({ error: MARKET_SCHEMA_MISSING_MESSAGE }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    stakePoints,
    positionStakePoints: nextStakePoints,
    walletBalance: nextBalance,
    market: marketViewWithSwing,
  });
}
