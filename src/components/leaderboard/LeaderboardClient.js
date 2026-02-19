'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import styles from './LeaderboardClient.module.css';

const PERIOD_OPTIONS = [
  { value: 'weekly', label: '주간' },
  { value: 'monthly', label: '월간' },
  { value: 'all', label: '전체' },
];

function formatSignedPoints(value) {
  const numeric = Number(value) || 0;
  if (numeric > 0) return `+${numeric}P`;
  return `${numeric}P`;
}

export default function LeaderboardClient() {
  const [period, setPeriod] = useState('weekly');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);
  const [mine, setMine] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchLeaderboard() {
      setLoading(true);
      setErrorMessage('');

      try {
        const response = await fetch(`/api/leaderboard?period=${period}&limit=50`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload?.error || '리더보드 데이터를 불러오지 못했습니다.');
        }

        setLeaderboard(payload.leaderboard || []);
        setMine(payload.mine || null);
      } catch (error) {
        if (error?.name === 'AbortError') return;
        setLeaderboard([]);
        setMine(null);
        setErrorMessage(error?.message || '리더보드 데이터를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboard();

    return () => controller.abort();
  }, [period]);

  const mineRow = useMemo(() => {
    if (!mine?.userId) return null;
    return leaderboard.find((item) => item.userId === mine.userId) || mine;
  }, [leaderboard, mine]);

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <Link href='/dashboard' className={styles.backLink}>
          대시보드로 돌아가기
        </Link>
      </div>

      <section className={styles.card}>
        <div className={styles.headerRow}>
          <h1 className={styles.title}>리더보드</h1>
          <div className={styles.tabRow}>
            {PERIOD_OPTIONS.map((item) => (
              <button
                key={item.value}
                type='button'
                className={`${styles.tabBtn} ${period === item.value ? styles.activeTab : ''}`}
                onClick={() => setPeriod(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {mineRow ? (
          <div className={styles.mineBox}>
            <span className={styles.mineLabel}>내 순위</span>
            <span className={styles.mineText}>
              {mineRow.rank || '-'}위 · {mineRow.displayName || '나'} ·
              {' '}
              {period === 'all' ? formatSignedPoints(mineRow.totalPnl) : formatSignedPoints(mineRow.periodPnl)}
            </span>
          </div>
        ) : null}

        {loading ? <div className={styles.empty}>리더보드 데이터를 불러오는 중...</div> : null}
        {!loading && leaderboard.length === 0 ? (
          <div className={styles.empty}>표시할 순위 데이터가 없습니다.</div>
        ) : null}

        {!loading && leaderboard.length > 0 ? (
          <div className={styles.tableWrap}>
            <div className={styles.tableHeader}>
              <span>순위</span>
              <span>사용자</span>
              <span>{period === 'all' ? '누적 손익' : '기간 손익'}</span>
            </div>

            {leaderboard.map((item) => {
              const highlighted = mine?.userId && mine.userId === item.userId;
              const pnl = period === 'all' ? item.totalPnl : item.periodPnl;

              return (
                <div key={item.userId} className={`${styles.tableRow} ${highlighted ? styles.highlighted : ''}`}>
                  <span className={styles.rank}>{item.rank}</span>
                  <span className={styles.name}>{item.displayName}</span>
                  <span className={styles.pnl}>{formatSignedPoints(pnl)}</span>
                </div>
              );
            })}
          </div>
        ) : null}

        {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
      </section>
    </div>
  );
}
