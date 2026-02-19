export const runtime = 'edge';
import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient, hasSupabaseAdminEnv } from '@/lib/supabase/admin';
import { isMarketSchemaMissingError, maskEmail } from '@/lib/markets/server';

const MARKET_SCHEMA_MISSING_MESSAGE =
  '예측 마켓 테이블이 없습니다. Supabase 마이그레이션 20260219_prediction_market.sql을 실행해주세요.';

function getSinceDate(period) {
  const now = Date.now();

  if (period === 'weekly') {
    return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  }

  if (period === 'monthly') {
    return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  }

  return null;
}

async function getEmailMap(admin, userIds) {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return new Map();
  }

  const map = new Map();
  await Promise.all(
    userIds.map(async (userId) => {
      try {
        const { data } = await admin.auth.admin.getUserById(userId);
        map.set(userId, maskEmail(data?.user?.email || ''));
      } catch {
        map.set(userId, '');
      }
    }),
  );

  return map;
}

async function buildPeriodPnlMap(admin, sinceIso) {
  const pnlMap = new Map();

  let query = admin
    .from('user_points_ledger')
    .select('user_id, delta, type, created_at')
    .in('type', ['stake_lock', 'payout', 'refund']);

  if (sinceIso) {
    query = query.gte('created_at', sinceIso);
  }

  const { data, error } = await query.limit(20000);
  if (error) {
    throw error;
  }

  (data || []).forEach((row) => {
    const current = pnlMap.get(row.user_id) || 0;
    pnlMap.set(row.user_id, current + (Number(row.delta) || 0));
  });

  return pnlMap;
}

export async function GET(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const periodRaw = searchParams.get('period') || 'all';
  const period = ['all', 'weekly', 'monthly'].includes(periodRaw) ? periodRaw : 'all';
  const limitRaw = Number.parseInt(searchParams.get('limit') || '', 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 20;
  const sinceIso = getSinceDate(period);

  if (!hasSupabaseAdminEnv()) {
    const { data: ownStats, error: ownStatsError } = await supabase
      .from('user_prediction_stats')
      .select('resolved_count, win_count, hit_rate, total_pnl, rating')
      .eq('user_id', user.id)
      .maybeSingle();

    if (ownStatsError && isMarketSchemaMissingError(ownStatsError)) {
      return NextResponse.json({ error: MARKET_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }

    return NextResponse.json({
      period,
      leaderboard: [
        {
          rank: 1,
          userId: user.id,
          displayName: '익명',
          resolvedCount: Number(ownStats?.resolved_count) || 0,
          winCount: Number(ownStats?.win_count) || 0,
          hitRate: Number(ownStats?.hit_rate) || 0,
          totalPnl: Number(ownStats?.total_pnl) || 0,
          periodPnl: Number(ownStats?.total_pnl) || 0,
          rating: Number(ownStats?.rating) || 1000,
        },
      ],
      mine: {
        rank: 1,
        userId: user.id,
      },
    });
  }

  const admin = createAdminClient();
  let pnlByUser;
  try {
    pnlByUser = await buildPeriodPnlMap(admin, sinceIso);
  } catch (error) {
    if (isMarketSchemaMissingError(error)) {
      return NextResponse.json({ error: MARKET_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: stats, error: statsError } = await admin
    .from('user_prediction_stats')
    .select('user_id, resolved_count, win_count, hit_rate, total_pnl, rating')
    .order('total_pnl', { ascending: false })
    .limit(500);

  if (statsError) {
    if (isMarketSchemaMissingError(statsError)) {
      return NextResponse.json({ error: MARKET_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    return NextResponse.json({ error: statsError.message }, { status: 500 });
  }

  const statsByUser = new Map(
    (stats || []).map((item) => [
      item.user_id,
      {
        resolvedCount: Number(item.resolved_count) || 0,
        winCount: Number(item.win_count) || 0,
        hitRate: Number(item.hit_rate) || 0,
        totalPnl: Number(item.total_pnl) || 0,
        rating: Number(item.rating) || 1000,
      },
    ]),
  );

  const userIds = new Set([...statsByUser.keys(), ...pnlByUser.keys(), user.id]);

  const rows = [...userIds].map((userId) => {
    const base = statsByUser.get(userId) || {
      resolvedCount: 0,
      winCount: 0,
      hitRate: 0,
      totalPnl: 0,
      rating: 1000,
    };

    return {
      userId,
      resolvedCount: base.resolvedCount,
      winCount: base.winCount,
      hitRate: base.hitRate,
      totalPnl: base.totalPnl,
      periodPnl: pnlByUser.get(userId) || 0,
      rating: base.rating,
    };
  });

  rows.sort((a, b) => {
    const left = period === 'all' ? a.totalPnl : a.periodPnl;
    const right = period === 'all' ? b.totalPnl : b.periodPnl;
    if (right !== left) return right - left;
    return b.hitRate - a.hitRate;
  });

  const ranked = rows.map((item, index) => ({
    rank: index + 1,
    ...item,
  }));

  const topRows = ranked.slice(0, limit);
  const displayMap = await getEmailMap(
    admin,
    topRows.map((item) => item.userId),
  );

  const leaderboard = topRows.map((item) => ({
    ...item,
    displayName: displayMap.get(item.userId) || item.userId.slice(0, 8),
  }));

  const mine = ranked.find((item) => item.userId === user.id) || null;

  return NextResponse.json({
    period,
    leaderboard,
    mine,
  });
}

