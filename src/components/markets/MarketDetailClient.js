'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import styles from './MarketDetail.module.css';

function toPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 50;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function formatLocal(dateValue) {
  const date = new Date(dateValue);
  if (!Number.isFinite(date.getTime())) return '시간 정보 없음';
  return date.toLocaleString();
}

function formatOutcome(outcome) {
  if (outcome === 'up') return '상승';
  if (outcome === 'down') return '하락';
  if (outcome === 'void') return '무효';
  return '';
}

function formatSwingAlert(swingAlert) {
  if (!swingAlert?.active) return '';

  const directionLabel = swingAlert.direction === 'up' ? '상승' : '하락';
  const previous = Number.isFinite(Number(swingAlert.previousUpRatio))
    ? `${swingAlert.previousUpRatio}%`
    : '-';
  const current = Number.isFinite(Number(swingAlert.currentUpRatio))
    ? `${swingAlert.currentUpRatio}%`
    : '-';

  return `확률 급변 알림: 직전 대비 ${directionLabel} ${swingAlert.deltaAbs}%p (${previous} → ${current})`;
}

export default function MarketDetailClient({ marketId }) {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [walletBalance, setWalletBalance] = useState(0);
  const [stakePoints, setStakePoints] = useState(100);
  const [market, setMarket] = useState(null);
  const [recentSeries, setRecentSeries] = useState([]);
  const [placingSide, setPlacingSide] = useState('');

  useEffect(() => {
    if (!marketId) return;

    const controller = new AbortController();

    async function fetchDetail() {
      setLoading(true);
      setErrorMessage('');

      try {
        const response = await fetch(`/api/markets/${marketId}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || '마켓 상세 정보를 불러오지 못했습니다.');
        }

        setMarket(payload.market || null);
        setWalletBalance(Number(payload.walletBalance) || 0);
        setStakePoints(Number(payload.stakePoints) || 100);
        setRecentSeries(payload.recentSeries || []);
      } catch (error) {
        if (error?.name === 'AbortError') return;
        setMarket(null);
        setRecentSeries([]);
        setErrorMessage(error?.message || '마켓 상세 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    }

    fetchDetail();

    return () => controller.abort();
  }, [marketId]);

  async function handleVote(side) {
    if (!market || !side || placingSide) return;
    setPlacingSide(side);
    setErrorMessage('');

    try {
      const response = await fetch(`/api/markets/${market.id}/position`, {
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

      setMarket(payload.market || null);
      setWalletBalance(Number(payload.walletBalance) || 0);
    } catch (error) {
      setErrorMessage(error?.message || '참여 처리에 실패했습니다.');
    } finally {
      setPlacingSide('');
    }
  }

  const crowdUp = useMemo(() => toPercent(market?.crowd?.upRatio), [market]);
  const crowdDown = 100 - crowdUp;

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>마켓 상세 정보를 불러오는 중...</div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className={styles.page}>
        <div className={styles.empty}>마켓을 찾을 수 없습니다.</div>
      </div>
    );
  }

  const mySide = market?.myPosition?.side || null;
  const voteLocked = !market.canVote || !!placingSide;
  const disableUp = voteLocked || (mySide && mySide !== 'up');
  const disableDown = voteLocked || (mySide && mySide !== 'down');
  const outcomeLabel = formatOutcome(market.outcome);

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <Link href='/dashboard' className={styles.backLink}>
          대시보드로 돌아가기
        </Link>
      </div>

      <article className={styles.card}>
        <h1 className={styles.title}>{market.title}</h1>

        <div className={styles.meta}>
          <span>카테고리: {market.subCategory}</span>
          <span>오픈: {formatLocal(market.openAt)}</span>
          <span>마감: {formatLocal(market.lockAt)}</span>
          <span>정산: {formatLocal(market.resolveAt)}</span>
        </div>

        <div className={styles.wallet}>
          <span className={styles.badge}>보유 {walletBalance}P</span>
          <span>참여 시 {stakePoints}P 사용</span>
        </div>

        <p className={styles.status}>
          기준 점수 {market.baselineScore}점
          {market.resolvedScore !== null && market.resolvedScore !== undefined
            ? ` / 정산 점수 ${market.resolvedScore}점`
            : ''}
          {outcomeLabel ? ` / 결과: ${outcomeLabel}` : ''}
        </p>

        <div className={styles.crowdBox}>
          <div className={styles.crowdBar}>
            <div className={styles.up} style={{ width: `${crowdUp}%` }} />
            <div className={styles.down} style={{ width: `${crowdDown}%` }} />
          </div>
          <div className={styles.crowdMeta}>
            <span>상승 {crowdUp}%</span>
            <span>하락 {crowdDown}%</span>
            <span>풀 {market?.crowd?.totalPool || 0}P</span>
          </div>
          {market?.swingAlert?.active ? (
            <div
              className={`${styles.swingAlert} ${
                market.swingAlert.direction === 'up' ? styles.swingUp : styles.swingDown
              }`}
            >
              {formatSwingAlert(market.swingAlert)}
            </div>
          ) : null}
        </div>

        <div className={styles.buttonRow}>
          <button
            type='button'
            className={`${styles.voteBtn} ${styles.upBtn} ${mySide === 'up' ? styles.selectedUp : ''}`}
            onClick={() => handleVote('up')}
            disabled={disableUp}
          >
            {placingSide === 'up' ? '처리 중...' : mySide === 'up' ? `상승 추가 배팅 (+${stakePoints}P)` : '상승 예측'}
          </button>
          <button
            type='button'
            className={`${styles.voteBtn} ${styles.downBtn} ${mySide === 'down' ? styles.selectedDown : ''}`}
            onClick={() => handleVote('down')}
            disabled={disableDown}
          >
            {placingSide === 'down' ? '처리 중...' : mySide === 'down' ? `하락 추가 배팅 (+${stakePoints}P)` : '하락 예측'}
          </button>
        </div>

        <p className={styles.status}>
          {mySide
            ? `내 선택: ${mySide === 'up' ? '상승' : '하락'} (${market?.myPosition?.stakePoints || 0}P 참여 중)`
            : '아직 참여하지 않았습니다.'}
        </p>

        {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>최근 카테고리 점수</h2>
          {recentSeries.length > 0 ? (
            recentSeries.map((item, index) => (
              <div key={`${item.analyzed_at}-${index}`} className={styles.seriesRow}>
                <span>{formatLocal(item.analyzed_at)}</span>
                <span>{item.score}점</span>
              </div>
            ))
          ) : (
            <div className={styles.seriesRow}>최근 점수 데이터가 없습니다.</div>
          )}
        </section>
      </article>
    </div>
  );
}
