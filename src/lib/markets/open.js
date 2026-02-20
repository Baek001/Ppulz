import {
  buildMarketTitle,
  getLatestCategoryScore,
  getMarketCooldownHours,
  getMarketCycleHours,
  getMarketVotingHours,
  toMarketKey,
} from '@/lib/markets/server';

export async function ensureOpenMarketsForSubCategories(
  admin,
  subCategories,
  { now = new Date() } = {},
) {
  const uniqueSubCategories = [...new Set((subCategories || []).filter(Boolean))];
  if (uniqueSubCategories.length === 0) {
    return {
      openedCount: 0,
      openedSubCategories: [],
    };
  }

  const nowIso = now.toISOString();
  const votingHours = getMarketVotingHours();
  const cooldownHours = getMarketCooldownHours();
  const cycleHours = getMarketCycleHours();
  const lockAtIso = new Date(now.getTime() + votingHours * 60 * 60 * 1000).toISOString();
  const resolveAtIso = new Date(now.getTime() + cycleHours * 60 * 60 * 1000).toISOString();

  const { data: activeRows, error: activeError } = await admin
    .from('prediction_markets')
    .select('sub_category')
    .in('sub_category', uniqueSubCategories)
    .in('status', ['open', 'locked'])
    .gt('resolve_at', nowIso);

  if (activeError) {
    throw new Error(activeError.message);
  }

  const hasActiveBySubCategory = new Set((activeRows || []).map((row) => row.sub_category));
  const openedSubCategories = [];

  for (const subCategory of uniqueSubCategories) {
    if (hasActiveBySubCategory.has(subCategory)) {
      continue;
    }

    const baselineScore = await getLatestCategoryScore(admin, subCategory);
    const marketKey = toMarketKey(subCategory, now);

    const { error: upsertError } = await admin
      .from('prediction_markets')
      .upsert(
        {
          market_key: marketKey,
          sub_category: subCategory,
          title: buildMarketTitle(subCategory, votingHours),
          description: 'Ppulz ?대? ?먯닔 蹂?붾? 湲곗??쇰줈 ?먮룞 ?뺤궛?⑸땲??',
          status: 'open',
          resolve_rule: {
            metric: 'ppulse_score',
            voting_hours: votingHours,
            cooldown_hours: cooldownHours,
            cycle_hours: cycleHours,
            window_hours: cycleHours,
            threshold: 0,
            mode: 'delta',
          },
          open_at: nowIso,
          lock_at: lockAtIso,
          resolve_at: resolveAtIso,
          baseline_score: baselineScore,
        },
        {
          onConflict: 'market_key',
          ignoreDuplicates: true,
        },
      );

    if (upsertError) {
      throw new Error(upsertError.message);
    }

    openedSubCategories.push(subCategory);
  }

  return {
    openedCount: openedSubCategories.length,
    openedSubCategories,
  };
}

