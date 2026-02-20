const MARKET_SIDES = ['up', 'down'];
const MARKET_STATUSES = ['open', 'locked', 'resolved', 'cancelled'];
const ANALYSIS_COUNTRIES = ['mix', 'kr', 'us'];
const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205']);
const SWING_ALERT_THRESHOLD_PERCENT = 10;

function parsePositiveInt(value, fallbackValue) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue;
}

function parseOptionalPositiveInt(value) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function getStakePoints() {
  return parsePositiveInt(process.env.MARKET_STAKE_POINTS, 100);
}

export function getWalletSeedPoints() {
  return parsePositiveInt(process.env.MARKET_WALLET_SEED, 1000);
}

export function getMarketCooldownHours() {
  const explicit = parseOptionalPositiveInt(process.env.MARKET_COOLDOWN_HOURS);
  return explicit ?? 1;
}

export function getMarketVotingHours() {
  const explicit = parseOptionalPositiveInt(process.env.MARKET_VOTING_HOURS);
  if (explicit !== null) {
    return explicit;
  }

  const legacyWindowHours = parseOptionalPositiveInt(process.env.MARKET_WINDOW_HOURS);
  if (legacyWindowHours !== null) {
    return Math.max(1, legacyWindowHours - getMarketCooldownHours());
  }

  return 23;
}

export function getMarketCycleHours() {
  return getMarketVotingHours() + getMarketCooldownHours();
}

// Legacy alias: historical code and env used MARKET_WINDOW_HOURS as total cycle.
export function getMarketWindowHours() {
  return getMarketCycleHours();
}

export function normalizeSide(side) {
  return MARKET_SIDES.includes(side) ? side : null;
}

export function normalizeStatusList(statusRaw) {
  if (!statusRaw || typeof statusRaw !== 'string') {
    return ['open', 'locked'];
  }

  const parsed = statusRaw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => MARKET_STATUSES.includes(item));

  return parsed.length > 0 ? parsed : ['open', 'locked'];
}

export function isMarketSchemaMissingError(error) {
  if (!error) return false;

  if (MISSING_TABLE_CODES.has(error.code)) {
    return true;
  }

  const message = String(error.message || '').toLowerCase();
  const includesMarketTables =
    message.includes('prediction_markets') || message.includes('prediction_market_snapshots');

  return (
    includesMarketTables &&
    (message.includes('does not exist') || message.includes('schema cache') || message.includes('could not find'))
  );
}

export function normalizeOutcomeFromDelta(delta) {
  if (!Number.isFinite(delta)) {
    return 'void';
  }

  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'void';
}

export function toMarketKey(subCategory, date = new Date()) {
  const hourKey = date.toISOString().slice(0, 13);
  return `${subCategory}:${hourKey}`;
}

export function buildMarketTitle(subCategory, windowHours = getMarketVotingHours()) {
  return `${subCategory} 점수 ${windowHours}시간 후 상승할까요?`;
}

export function extractSubCategories(onboardingSubCategories) {
  if (!Array.isArray(onboardingSubCategories)) {
    return [];
  }

  const values = onboardingSubCategories
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && typeof item.sub_category === 'string') {
        return item.sub_category;
      }
      return null;
    })
    .filter((item) => typeof item === 'string' && item.length > 0);

  return [...new Set(values)];
}

export function formatTimeLeft(targetDateString) {
  const targetMs = new Date(targetDateString).getTime();
  if (!Number.isFinite(targetMs)) return '시간 정보 없음';

  const diffMs = targetMs - Date.now();
  if (diffMs <= 0) return '마감됨';

  const diffMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;

  if (hours <= 0) {
    return `${minutes}분 남음`;
  }

  return `${hours}시간 ${minutes}분 남음`;
}

export async function getLatestCategoryScore(supabase, subCategory) {
  const { data, error } = await supabase
    .from('hourly_analysis')
    .select('score')
    .in('country', ANALYSIS_COUNTRIES)
    .eq('sub_category', subCategory)
    .order('analyzed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return 50;
  }

  const parsed = Number(data?.score);
  if (!Number.isFinite(parsed)) {
    return 50;
  }

  return Math.max(0, Math.min(100, Math.round(parsed)));
}

export async function ensureWalletRow(adminClient, userId) {
  const seedPoints = getWalletSeedPoints();

  await adminClient
    .from('user_points_wallet')
    .upsert(
      {
        user_id: userId,
        balance: seedPoints,
      },
      {
        onConflict: 'user_id',
        ignoreDuplicates: true,
      },
    );

  const { data, error } = await adminClient
    .from('user_points_wallet')
    .select('balance')
    .eq('user_id', userId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return Number(data.balance) || 0;
}

export async function getMarketAggregate(adminClient, marketIds, userId) {
  if (!Array.isArray(marketIds) || marketIds.length === 0) {
    return new Map();
  }

  const { data, error } = await adminClient
    .from('prediction_positions')
    .select('market_id, user_id, side, stake_points')
    .in('market_id', marketIds);

  if (error) {
    throw new Error(error.message);
  }

  const result = new Map();

  marketIds.forEach((marketId) => {
    result.set(marketId, {
      upCount: 0,
      downCount: 0,
      upPoints: 0,
      downPoints: 0,
      totalPool: 0,
      mySide: null,
      myStakePoints: 0,
    });
  });

  (data || []).forEach((position) => {
    const bucket = result.get(position.market_id);
    if (!bucket) return;

    const stake = Number(position.stake_points) || 0;
    bucket.totalPool += stake;

    if (position.side === 'up') {
      bucket.upCount += 1;
      bucket.upPoints += stake;
    } else if (position.side === 'down') {
      bucket.downCount += 1;
      bucket.downPoints += stake;
    }

    if (position.user_id === userId) {
      bucket.mySide = position.side;
      bucket.myStakePoints = stake;
    }
  });

  return result;
}

export function toMarketViewModel(market, aggregate) {
  const upPoints = aggregate?.upPoints ?? 0;
  const downPoints = aggregate?.downPoints ?? 0;
  const totalPoints = upPoints + downPoints;
  const upRatio = totalPoints > 0 ? Math.round((upPoints / totalPoints) * 100) : 50;

  const lockAt = market?.lock_at || market?.resolve_at;
  const nowMs = Date.now();
  const lockMs = new Date(lockAt).getTime();
  const isOpenByTime = Number.isFinite(lockMs) ? lockMs > nowMs : false;
  const canVote = market?.status === 'open' && isOpenByTime;

  return {
    id: market.id,
    marketKey: market.market_key,
    subCategory: market.sub_category,
    title: market.title,
    description: market.description || '',
    status: market.status,
    openAt: market.open_at,
    lockAt: market.lock_at,
    resolveAt: market.resolve_at,
    timeLeftText: formatTimeLeft(market.lock_at || market.resolve_at),
    baselineScore: market.baseline_score,
    resolvedScore: market.resolved_score,
    outcome: market.outcome,
    resolveRule: market.resolve_rule || {},
    crowd: {
      upCount: aggregate?.upCount ?? 0,
      downCount: aggregate?.downCount ?? 0,
      upPoints,
      downPoints,
      totalPool: aggregate?.totalPool ?? 0,
      upRatio,
      downRatio: 100 - upRatio,
    },
    myPosition: aggregate?.mySide
      ? {
          side: aggregate.mySide,
          stakePoints: aggregate.myStakePoints,
        }
      : null,
    canVote,
  };
}

function toClampedPercent(value, fallback = 50) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function toUpRatioFromPoints(upPoints, downPoints) {
  const up = Number(upPoints) || 0;
  const down = Number(downPoints) || 0;
  const total = up + down;

  if (total <= 0) {
    return 50;
  }

  return toClampedPercent((up / total) * 100);
}

function toSnapshotRatio(snapshot) {
  if (!snapshot) return null;

  return {
    upRatio: toUpRatioFromPoints(snapshot.up_points, snapshot.down_points),
    snapshotAt: snapshot.snapshot_at || null,
  };
}

export function buildSwingAlertFromSnapshots(
  currentUpRatio,
  snapshotRows,
  thresholdPercent = SWING_ALERT_THRESHOLD_PERCENT,
) {
  const current = toClampedPercent(currentUpRatio, 50);
  const threshold = Math.max(1, parsePositiveInt(thresholdPercent, SWING_ALERT_THRESHOLD_PERCENT));
  const normalizedRows = Array.isArray(snapshotRows)
    ? snapshotRows.map(toSnapshotRatio).filter(Boolean)
    : [];

  if (normalizedRows.length === 0) {
    return {
      active: false,
      threshold,
      direction: null,
      delta: 0,
      deltaAbs: 0,
      currentUpRatio: current,
      previousUpRatio: null,
      previousSnapshotAt: null,
    };
  }

  let baseline = normalizedRows[0];
  if (baseline.upRatio === current && normalizedRows.length > 1) {
    baseline = normalizedRows[1];
  }

  const delta = current - baseline.upRatio;
  const deltaAbs = Math.abs(delta);

  return {
    active: deltaAbs >= threshold,
    threshold,
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : null,
    delta,
    deltaAbs,
    currentUpRatio: current,
    previousUpRatio: baseline.upRatio,
    previousSnapshotAt: baseline.snapshotAt,
  };
}

export function withMarketSwingAlert(marketView, snapshotRows) {
  return {
    ...marketView,
    swingAlert: buildSwingAlertFromSnapshots(marketView?.crowd?.upRatio, snapshotRows),
  };
}

export async function getRecentMarketSnapshots(adminClient, marketIds, perMarketLimit = 2) {
  const ids = Array.isArray(marketIds) ? marketIds.filter(Boolean) : [];
  const limit = Math.max(1, parsePositiveInt(perMarketLimit, 2));
  const snapshotsByMarket = new Map();

  ids.forEach((marketId) => {
    snapshotsByMarket.set(marketId, []);
  });

  if (ids.length === 0) {
    return snapshotsByMarket;
  }

  const perMarketRows = await Promise.all(
    ids.map(async (marketId) => {
      const { data, error } = await adminClient
        .from('prediction_market_snapshots')
        .select('snapshot_at, up_points, down_points')
        .eq('market_id', marketId)
        .order('snapshot_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return [marketId, data || []];
    }),
  );

  perMarketRows.forEach(([marketId, rows]) => {
    snapshotsByMarket.set(marketId, rows);
  });

  return snapshotsByMarket;
}

export async function appendLedgerRow(adminClient, {
  userId,
  type,
  delta,
  balanceAfter,
  refType,
  refId,
  meta,
}) {
  const payload = {
    user_id: userId,
    type,
    delta,
    balance_after: balanceAfter,
    ref_type: refType || null,
    ref_id: refId || null,
    meta: meta || {},
  };

  const { error } = await adminClient
    .from('user_points_ledger')
    .insert(payload);

  if (error) {
    throw new Error(error.message);
  }
}

export async function addWalletBalance(adminClient, userId, delta) {
  const { data: wallet, error: walletError } = await adminClient
    .from('user_points_wallet')
    .select('balance')
    .eq('user_id', userId)
    .single();

  if (walletError) {
    throw new Error(walletError.message);
  }

  const nextBalance = Math.max(0, (Number(wallet.balance) || 0) + delta);

  const { error: updateError } = await adminClient
    .from('user_points_wallet')
    .update({ balance: nextBalance })
    .eq('user_id', userId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return nextBalance;
}

export async function upsertUserStats(adminClient, userId, { isWin, pnlDelta }) {
  await adminClient
    .from('user_prediction_stats')
    .upsert(
      {
        user_id: userId,
        resolved_count: 0,
        win_count: 0,
        hit_rate: 0,
        total_pnl: 0,
        rating: 1000,
      },
      {
        onConflict: 'user_id',
        ignoreDuplicates: true,
      },
    );

  const { data: stats, error: statsError } = await adminClient
    .from('user_prediction_stats')
    .select('resolved_count, win_count, total_pnl')
    .eq('user_id', userId)
    .single();

  if (statsError) {
    throw new Error(statsError.message);
  }

  const resolvedCount = (Number(stats.resolved_count) || 0) + 1;
  const winCount = (Number(stats.win_count) || 0) + (isWin ? 1 : 0);
  const totalPnl = (Number(stats.total_pnl) || 0) + (Number(pnlDelta) || 0);
  const hitRate = resolvedCount > 0 ? Number(((winCount / resolvedCount) * 100).toFixed(2)) : 0;

  const { error: updateError } = await adminClient
    .from('user_prediction_stats')
    .update({
      resolved_count: resolvedCount,
      win_count: winCount,
      total_pnl: totalPnl,
      hit_rate: hitRate,
    })
    .eq('user_id', userId);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

export function maskEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return '';
  }

  const [localPart, domain] = email.split('@');
  if (!localPart) return `***@${domain}`;

  if (localPart.length <= 2) {
    return `${localPart[0] || '*'}*@${domain}`;
  }

  return `${localPart.slice(0, 2)}***@${domain}`;
}
