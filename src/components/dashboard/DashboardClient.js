'use client';

import { useEffect, useRef, useState } from 'react';
import DashboardHeader from './DashboardHeader';
import CategoryTabs from './CategoryTabs';
import ScoreGraph from './ScoreGraph';
import ScoreCard from './ScoreCard';
import PredictionMarketSection from './PredictionMarketSection';
import ReferenceSection from './ReferenceSection';
import styles from './Dashboard.module.css';

const DEFAULT_META = { stale: false, lastAnalyzedAt: null, seedQueued: false };

function toStatusText(reason) {
  if (reason === 'cooldown') return '잠시 후 다시';
  if (reason === 'processing') return '처리 중';
  if (reason === 'queued_retry') return '요청됨';
  if (reason === 'queue_unavailable') return '큐 미설정';
  if (reason === 'queue_failed') return '요청 실패';
  if (reason === 'no_items') return '자료 없음';
  return '요청 실패';
}

export default function DashboardClient() {
  const [tabs, setTabs] = useState([]);
  const [activeTab, setActiveTab] = useState('');
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seriesError, setSeriesError] = useState('');
  const [seriesMeta, setSeriesMeta] = useState(DEFAULT_META);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState('');
  const refreshTimeoutRef = useRef(null);

  useEffect(() => {
    async function fetchTabs() {
      try {
        const res = await fetch('/api/dashboard/tabs');
        if (res.ok) {
          const data = await res.json();
          setTabs(data.tabs || []);
          setActiveTab((data.tabs || [])[0] || '');
        } else {
          setTabs([]);
          setActiveTab('');
        }
      } catch (error) {
        console.error('Failed to fetch tabs', error);
        setTabs([]);
        setActiveTab('');
      } finally {
        setLoading(false);
      }
    }

    fetchTabs();
  }, []);

  useEffect(() => {
    if (!activeTab) return;

    const controller = new AbortController();

    async function fetchSeries() {
      try {
        setSeriesError('');
        const res = await fetch(`/api/dashboard/series?sub=${encodeURIComponent(activeTab)}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          setSeries([]);
          setSeriesMeta(DEFAULT_META);
          setSeriesError(payload.error || 'Failed to fetch series');
          return;
        }

        const data = await res.json();
        setSeries(data.series || []);
        setSeriesMeta(data.meta || DEFAULT_META);
        if (data?.meta?.seedQueued) {
          setRefreshStatus('요청됨');
        }
      } catch (error) {
        if (error?.name === 'AbortError') return;
        console.error('Failed to fetch series', error);
        setSeries([]);
        setSeriesMeta(DEFAULT_META);
        setSeriesError('Failed to fetch series');
      }
    }

    fetchSeries();

    return () => controller.abort();
  }, [activeTab]);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  async function handleRefresh() {
    if (!activeTab || refreshing) return;
    setRefreshing(true);
    setRefreshStatus('');

    try {
      const res = await fetch('/api/dashboard/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subCategory: activeTab }),
      });
      const payload = await res.json().catch(() => ({}));

      if (res.ok && payload?.queued) {
        setRefreshStatus(payload?.immediate ? '완료' : '요청됨');
        if (payload?.immediate) {
          const seriesRes = await fetch(`/api/dashboard/series?sub=${encodeURIComponent(activeTab)}`);
          if (seriesRes.ok) {
            const seriesPayload = await seriesRes.json();
            setSeries(seriesPayload.series || []);
            setSeriesMeta(seriesPayload.meta || DEFAULT_META);
          }
        }
      } else {
        setRefreshStatus(toStatusText(payload?.reason));
      }
    } catch (error) {
      console.error('Failed to queue refresh', error);
      setRefreshStatus('요청 실패');
    } finally {
      setRefreshing(false);
    }

    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = setTimeout(() => {
      setRefreshStatus('');
    }, 30000);
  }

  const currentData = series.length > 0 ? series[series.length - 1] : null;

  if (loading) {
    return <div className={styles.page}>Loading...</div>;
  }

  return (
    <div className={styles.page}>
      <DashboardHeader lastUpdated={currentData?.timestamp} />

      <CategoryTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        refreshDisabled={!activeTab || refreshing}
        refreshStatus={refreshStatus}
        stale={seriesMeta?.stale}
      />

      <ScoreGraph data={series} />
      <ScoreCard current={currentData} />
      <PredictionMarketSection activeTab={activeTab} />
      <ReferenceSection references={currentData?.references} />

      {seriesError ? (
        <p style={{ margin: '0 20px', color: '#8b95a1', fontSize: '13px' }}>
          {seriesError}
        </p>
      ) : null}
    </div>
  );
}
