import {
  addWalletBalance,
  appendLedgerRow,
  ensureWalletRow,
  normalizeOutcomeFromDelta,
  upsertUserStats,
} from '@/lib/markets/server';

const RESOLVE_COUNTRIES = ['mix', 'kr', 'us'];

async function getResolveScore(admin, subCategory) {
  const { data } = await admin
    .from('hourly_analysis')
    .select('score')
    .in('country', RESOLVE_COUNTRIES)
    .eq('sub_category', subCategory)
    .order('analyzed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const score = Number(data?.score);
  return Number.isFinite(score) ? Math.round(score) : null;
}

export async function settleMarket(admin, market) {
  const { data: positions, error: positionsError } = await admin
    .from('prediction_positions')
    .select('user_id, side, stake_points')
    .eq('market_id', market.id);

  if (positionsError) {
    throw new Error(positionsError.message);
  }

  const resolvedScore = await getResolveScore(admin, market.sub_category);
  const delta = resolvedScore === null ? Number.NaN : resolvedScore - Number(market.baseline_score || 0);
  const outcome = normalizeOutcomeFromDelta(delta);

  const positionRows = positions || [];
  const hasPositions = positionRows.length > 0;

  if (!hasPositions) {
    const { error: updateError } = await admin
      .from('prediction_markets')
      .update({
        status: 'resolved',
        outcome,
        resolved_score: resolvedScore,
      })
      .eq('id', market.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return {
      marketId: market.id,
      outcome,
      resolvedScore,
      payouts: 0,
      refunds: 0,
      participants: 0,
    };
  }

  const totalPool = positionRows.reduce((sum, item) => sum + (Number(item.stake_points) || 0), 0);

  if (outcome === 'void') {
    for (const position of positionRows) {
      await ensureWalletRow(admin, position.user_id);
      const nextBalance = await addWalletBalance(admin, position.user_id, Number(position.stake_points) || 0);
      await appendLedgerRow(admin, {
        userId: position.user_id,
        type: 'refund',
        delta: Number(position.stake_points) || 0,
        balanceAfter: nextBalance,
        refType: 'market',
        refId: market.id,
        meta: { reason: 'void' },
      });
    }

    const { error: updateError } = await admin
      .from('prediction_markets')
      .update({
        status: 'resolved',
        outcome: 'void',
        resolved_score: resolvedScore,
      })
      .eq('id', market.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return {
      marketId: market.id,
      outcome: 'void',
      resolvedScore,
      payouts: 0,
      refunds: positionRows.length,
      participants: positionRows.length,
    };
  }

  const winners = positionRows.filter((position) => position.side === outcome);

  if (winners.length === 0) {
    for (const position of positionRows) {
      await ensureWalletRow(admin, position.user_id);
      const nextBalance = await addWalletBalance(admin, position.user_id, Number(position.stake_points) || 0);
      await appendLedgerRow(admin, {
        userId: position.user_id,
        type: 'refund',
        delta: Number(position.stake_points) || 0,
        balanceAfter: nextBalance,
        refType: 'market',
        refId: market.id,
        meta: { reason: 'no_winner' },
      });
    }

    const { error: updateError } = await admin
      .from('prediction_markets')
      .update({
        status: 'resolved',
        outcome: 'void',
        resolved_score: resolvedScore,
      })
      .eq('id', market.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return {
      marketId: market.id,
      outcome: 'void',
      resolvedScore,
      payouts: 0,
      refunds: positionRows.length,
      participants: positionRows.length,
    };
  }

  const payoutPerWinner = Math.max(0, Math.floor(totalPool / winners.length));
  const winnerUserIds = new Set(winners.map((winner) => winner.user_id));

  for (const position of positionRows) {
    const isWinner = winnerUserIds.has(position.user_id);
    const stake = Number(position.stake_points) || 0;
    const payout = isWinner ? payoutPerWinner : 0;
    const pnlDelta = payout - stake;

    await ensureWalletRow(admin, position.user_id);
    if (payout > 0) {
      const nextBalance = await addWalletBalance(admin, position.user_id, payout);
      await appendLedgerRow(admin, {
        userId: position.user_id,
        type: 'payout',
        delta: payout,
        balanceAfter: nextBalance,
        refType: 'market',
        refId: market.id,
        meta: { side: position.side, payoutPerWinner },
      });
    }

    await upsertUserStats(admin, position.user_id, {
      isWin: isWinner,
      pnlDelta,
    });
  }

  const { error: updateError } = await admin
    .from('prediction_markets')
    .update({
      status: 'resolved',
      outcome,
      resolved_score: resolvedScore,
    })
    .eq('id', market.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return {
    marketId: market.id,
    outcome,
    resolvedScore,
    payouts: winners.length,
    refunds: 0,
    participants: positionRows.length,
  };
}

export async function resolveDueMarkets(admin, { nowIso = new Date().toISOString(), limit = 50 } = {}) {
  const { data: targets, error: targetError } = await admin
    .from('prediction_markets')
    .select('id, sub_category, baseline_score, status, resolve_at')
    .in('status', ['open', 'locked'])
    .lte('resolve_at', nowIso)
    .order('resolve_at', { ascending: true })
    .limit(limit);

  if (targetError) {
    throw new Error(targetError.message);
  }

  const results = [];

  for (const market of targets || []) {
    try {
      const itemResult = await settleMarket(admin, market);
      results.push({ ok: true, ...itemResult });
    } catch (error) {
      results.push({
        ok: false,
        marketId: market.id,
        error: error?.message || '정산 처리에 실패했습니다.',
      });
    }
  }

  return {
    results,
    resolvedCount: results.filter((item) => item.ok).length,
    failedCount: results.filter((item) => !item.ok).length,
  };
}
