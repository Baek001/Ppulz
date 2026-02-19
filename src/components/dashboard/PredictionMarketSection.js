'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import styles from './PredictionMarketSection.module.css';

const MIGRATION_GUIDE =
  '예측 마켓 테이블이 없습니다. Supabase 마이그레이션 파일 `supabase/migrations/20260219_prediction_market.sql`을 실행해주세요.';

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

function normalizeApiError(payloadError, statusCode) {
  if (statusCode === 503) {
    return MIGRATION_GUIDE;
  }

  if (typeof payloadError === 'string' && payloadError.trim().length > 0) {
    return payloadError;
  }

  return '마켓 데이터를 불러오지 못했습니다.';
}

export default function PredictionMarketSection({ activeTab }) {
  const [loading, setLoading] = useState(true);
  const [markets, setMarkets] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [stakePoints, setStakePoints] = useState(100);
  const [errorMessage, setErrorMessage] = useState('');
  const [placingKey, setPlacingKey] = useState('');

  useEffect(() => {
    if (!activeTab) return;

    const controller = new AbortController();

    async function fetchMarkets() {
      setLoading(true);
      setErrorMessage('');

      try {
        const response = await fetch(`/api/markets?sub=${encodeURIComponent(activeTab)}&status=open,locked`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(normalizeApiError(payload?.error, response.status));
        }

        setMarkets(payload.markets || []);
        setWalletBalance(Number(payload.walletBalance) || 0);
        setStakePoints(Number(payload.stakePoints) || 100);
      } catch (error) {
        if (error?.name === 'AbortError') return;
        setMarkets([]);
        setErrorMessage(error?.message || '마켓 데이터를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    }

    fetchMarkets();

    return () => controller.abort();
  }, [activeTab]);

  async function handleVote(marketId, side) {
    if (!marketId || !side || placingKey) return;

    const key = `${marketId}:${side}`;
    setPlacingKey(key);
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
        throw new Error(normalizeApiError(payload?.error, response.status));
      }

      setWalletBalance(Number(payload.walletBalance) || 0);
      setMarkets((current) =>
        current.map((item) => (item.id === marketId ? payload.market : item)),
      );
    } catch (error) {
      setErrorMessage(error?.message || '예측 참여 처리에 실패했습니다.');
    } finally {
      setPlacingKey('');
    }
  }

  const hasMarkets = markets.length > 0;
  const marketList = useMemo(() => markets, [markets]);

  return (
    <section className={styles.section}>
      <div className={styles.headerRow}>
        <h3 className={styles.title}>예측 마켓</h3>
        <div className={styles.headerMeta}>
          <Link href='/leaderboard' className={styles.leaderboardLink}>
            리더보드 보기
          </Link>
          <span className={styles.walletBadge}>보유 {walletBalance}P</span>
        </div>
      </div>
      <p className={styles.desc}>현재 탭의 상승/하락을 예측하세요. 참여마다 {stakePoints}P가 사용됩니다.</p>

      {loading ? <div className={styles.empty}>마켓 데이터를 불러오는 중...</div> : null}

      {!loading && !hasMarkets ? (
        <div className={styles.empty}>현재 진행 중인 마켓이 없습니다. 잠시 후 다시 확인해주세요.</div>
      ) : null}

      {!loading && hasMarkets
        ? marketList.map((market) => {
            const upRatio = toPercent(market?.crowd?.upRatio);
            const downRatio = 100 - upRatio;
            const mySide = market?.myPosition?.side || null;
            const isBusy = placingKey.startsWith(`${market.id}:`);
            const voteLocked = !market.canVote || !!placingKey;
            const disableUp = voteLocked || (mySide && mySide !== 'up');
            const disableDown = voteLocked || (mySide && mySide !== 'down');

            return (
              <article key={market.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <h4 className={styles.cardTitle}>{market.title}</h4>
                  <span className={styles.timeText}>{market.timeLeftText}</span>
                </div>

                <div className={styles.crowdWrap}>
                  <div className={styles.crowdBar}>
                    <div className={styles.crowdUp} style={{ width: `${upRatio}%` }} />
                    <div className={styles.crowdDown} style={{ width: `${downRatio}%` }} />
                  </div>
                  <div className={styles.crowdMeta}>
                    <span>상승 {upRatio}%</span>
                    <span>하락 {downRatio}%</span>
                    <span>풀 {market?.crowd?.totalPool || 0}P</span>
                  </div>
                </div>

                <div className={styles.buttonRow}>
                  <button
                    type='button'
                    className={`${styles.voteBtn} ${styles.upBtn} ${mySide === 'up' ? styles.selectedUp : ''}`}
                    disabled={disableUp}
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
                    disabled={disableDown}
                    onClick={() => handleVote(market.id, 'down')}
                  >
                    {isBusy && placingKey.endsWith(':down')
                      ? '처리 중...'
                      : mySide === 'down'
                        ? `하락 추가 (+${stakePoints}P)`
                        : '하락 예측'}
                  </button>
                </div>

                <div className={styles.metaRow}>
                  <span className={styles.myPick}>
                    {mySide
                      ? `내 선택: ${toSideLabel(mySide)} (${market?.myPosition?.stakePoints || 0}P)`
                      : '아직 참여하지 않았습니다.'}
                  </span>
                  <Link href={`/markets/${market.id}`} className={styles.detailLink}>
                    상세 보기
                  </Link>
                </div>
              </article>
            );
          })
        : null}

      {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
    </section>
  );
}
