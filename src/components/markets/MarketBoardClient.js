'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import styles from './MarketBoardClient.module.css';

function toPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 50;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function toSideLabel(side) {
  if (side === 'up') return '상승';
  if (side === 'down') return '하락';
  return '';
}

function toSwingAlertText(swingAlert) {
  if (!swingAlert?.active) return '';
  const directionLabel = swingAlert.direction === 'up' ? '상승' : '하락';
  return `급변 ${swingAlert.deltaAbs}%p ${directionLabel}`;
}

export default function MarketBoardClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [placingKey, setPlacingKey] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('전체');
  const [stakePoints, setStakePoints] = useState(100);
  const [walletBalance, setWalletBalance] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [categories, setCategories] = useState([]);

  function handleGoBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/dashboard');
  }

  useEffect(() => {
    const controller = new AbortController();

    async function fetchBoard() {
      setLoading(true);
      setErrorMessage('');

      try {
        const response = await fetch('/api/markets/board', {
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload?.error || '마켓 보드 데이터를 불러오지 못했습니다.');
        }

        setStakePoints(Number(payload.stakePoints) || 100);
        setWalletBalance(Number(payload.walletBalance) || 0);
        setIsAuthenticated(!!payload.isAuthenticated);
        setCategories(Array.isArray(payload.categories) ? payload.categories : []);
      } catch (error) {
        if (error?.name === 'AbortError') return;
        setErrorMessage(error?.message || '마켓 보드 데이터를 불러오지 못했습니다.');
        setCategories([]);
      } finally {
        setLoading(false);
      }
    }

    fetchBoard();

    return () => controller.abort();
  }, []);

  const allFilters = useMemo(
    () => ['전체', ...categories.map((item) => item.bigCategory)],
    [categories],
  );

  const visibleMarkets = useMemo(() => {
    const flattened = categories.flatMap((item) =>
      (item.markets || []).map((market) => ({
        ...market,
        bigCategory: item.bigCategory,
      })),
    );

    if (selectedFilter === '전체') return flattened;
    return flattened.filter((item) => item.bigCategory === selectedFilter);
  }, [categories, selectedFilter]);

  async function handleVote(marketId, side) {
    if (!marketId || !side || placingKey) return;

    if (!isAuthenticated) {
      router.push('/login?next=/markets');
      return;
    }

    const voteKey = `${marketId}:${side}`;
    setPlacingKey(voteKey);
    setErrorMessage('');

    try {
      const response = await fetch(`/api/markets/${marketId}/position`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ side }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || '참여 처리에 실패했습니다.');
      }

      setWalletBalance(Number(payload.walletBalance) || 0);
      setCategories((current) =>
        current.map((bucket) => ({
          ...bucket,
          markets: (bucket.markets || []).map((market) =>
            market.id === marketId
              ? { ...market, ...(payload.market || {}), bigCategory: market.bigCategory }
              : market,
          ),
        })),
      );
    } catch (error) {
      setErrorMessage(error?.message || '참여 처리에 실패했습니다.');
    } finally {
      setPlacingKey('');
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.backRow}>
        <button type='button' className={styles.backBtn} onClick={handleGoBack}>
          ← 뒤로가기
        </button>
      </div>

      <div className={styles.topRow}>
        <h1 className={styles.title}>마켓 보드</h1>
        <div className={styles.topMeta}>
          <span className={styles.badge}>참여 단위 {stakePoints}P</span>
          <span className={styles.badge}>
            {isAuthenticated ? `보유 ${walletBalance}P` : '비로그인 미리보기 모드'}
          </span>
        </div>
      </div>

      <div className={styles.filterRow}>
        {allFilters.map((filter) => (
          <button
            key={filter}
            type='button'
            className={`${styles.filterBtn} ${selectedFilter === filter ? styles.activeFilter : ''}`}
            onClick={() => setSelectedFilter(filter)}
          >
            {filter}
          </button>
        ))}
      </div>

      {loading ? <div className={styles.empty}>마켓 보드를 불러오는 중...</div> : null}
      {!loading && visibleMarkets.length === 0 ? (
        <div className={styles.empty}>아직 생성된 마켓이 없습니다. 잠시 후 다시 확인해주세요.</div>
      ) : null}

      {!loading && visibleMarkets.length > 0 ? (
        <div className={styles.grid}>
          {visibleMarkets.map((market) => {
            const upRatio = toPercent(market?.crowd?.upRatio);
            const downRatio = 100 - upRatio;
            const mySide = market?.myPosition?.side || null;
            const isBusy = placingKey.startsWith(`${market.id}:`);
            const voteLocked = !market.canVote || !!placingKey;
            const disableUp = voteLocked || (mySide && mySide !== 'up');
            const disableDown = voteLocked || (mySide && mySide !== 'down');

            return (
              <article key={market.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.category}>{market.bigCategory}</span>
                  <div className={styles.headerRight}>
                    <span className={styles.timeLeft}>{market.timeLeftText}</span>
                    {market?.swingAlert?.active ? (
                      <span
                        className={`${styles.alertBadge} ${
                          market?.swingAlert?.direction === 'up' ? styles.alertUp : styles.alertDown
                        }`}
                      >
                        {toSwingAlertText(market.swingAlert)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <h3 className={styles.cardTitle}>{market.title}</h3>

                <div className={styles.crowdBar}>
                  <span className={styles.crowdUp} style={{ width: `${upRatio}%` }} />
                  <span className={styles.crowdDown} style={{ width: `${downRatio}%` }} />
                </div>
                <div className={styles.crowdMeta}>
                  <span>상승 {upRatio}%</span>
                  <span>하락 {downRatio}%</span>
                  <span>풀 {market?.crowd?.totalPool || 0}P</span>
                </div>

                <div className={styles.buttonRow}>
                  <button
                    type='button'
                    className={`${styles.voteBtn} ${styles.upBtn} ${mySide === 'up' ? styles.selectedUp : ''}`}
                    disabled={isAuthenticated ? disableUp : false}
                    onClick={() => handleVote(market.id, 'up')}
                  >
                    {isBusy && placingKey.endsWith(':up')
                      ? '처리 중...'
                      : mySide === 'up'
                        ? `상승 추가 (+${stakePoints}P)`
                        : '상승 예측'}
                  </button>
                  <button
                    type='button'
                    className={`${styles.voteBtn} ${styles.downBtn} ${mySide === 'down' ? styles.selectedDown : ''}`}
                    disabled={isAuthenticated ? disableDown : false}
                    onClick={() => handleVote(market.id, 'down')}
                  >
                    {isBusy && placingKey.endsWith(':down')
                      ? '처리 중...'
                      : mySide === 'down'
                        ? `하락 추가 (+${stakePoints}P)`
                        : '하락 예측'}
                  </button>
                </div>

                <div className={styles.cardFooter}>
                  <span className={styles.myPick}>
                    {mySide
                      ? `내 선택: ${toSideLabel(mySide)} (${market?.myPosition?.stakePoints || 0}P)`
                      : isAuthenticated
                        ? '아직 참여하지 않았습니다.'
                        : '로그인 후 참여할 수 있습니다.'}
                  </span>
                  <Link href={`/markets/${market.id}`} className={styles.detailLink}>
                    상세 보기
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
    </div>
  );
}
