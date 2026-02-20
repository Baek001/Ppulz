'use client';

import { useEffect, useRef, useState } from 'react';
import DashboardHeader from './DashboardHeader';
import CategoryTabs from './CategoryTabs';
import ScoreGraph from './ScoreGraph';
import ScoreCard from './ScoreCard';
import PredictionMarketSection from './PredictionMarketSection';
import ReferenceSection from './ReferenceSection';
import styles from './Dashboard.module.css';

const DEFAULT_META = {
  stale: false,
  lastAnalyzedAt: null,
  seedQueued: false,
  seedReason: 'fresh',
  seedStatus: null,
  sourceTier: null,
};

function toStatusText(reason) {
  if (reason === 'done') return '완료';
  if (reason === 'immediate_done') return '완료';
  if (reason === 'cooldown') return '잠시 후 다시';
  if (reason === 'processing') return '처리 중';
  if (reason === 'queued_retry') return '요청됨';
  if (reason === 'pending') return '요청됨';
  if (reason === 'manual_refresh') return '요청됨';
  if (reason === 'stale') return '요청됨';
  if (reason === 'insufficient') return '요청됨';
  if (reason === 'queue_unavailable') return '큐 미설정';
  if (reason === 'queue_failed') return '요청 실패';
  if (reason === 'failed') return '요청 실패';
  if (reason === 'done_no_data') return '데이터 부족';
  if (reason === 'no_items') return '자료 없음';
  return '요청 실패';
}

function getStatusFromMeta(meta) {
  if (!meta) return '';
  if (meta.seedQueued) return '요청됨';
  if (meta.seedStatus) return toStatusText(meta.seedStatus);
  return '';
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

  async function fetchSeriesForTab(tab, signal) {
    const res = await fetch(`/api/dashboard/series?sub=${encodeURIComponent(tab)}`, { signal });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload.error || 'Failed to fetch series');
    }
    return res.json();
  }

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

    async function run() {
      try {
        setSeriesError('');
        const data = await fetchSeriesForTab(activeTab, controller.signal);
        setSeries(data.series || []);
        setSeriesMeta(data.meta || DEFAULT_META);
        setRefreshStatus(getStatusFromMeta(data.meta));
      } catch (error) {
        if (error?.name === 'AbortError') return;
        setSeries([]);
        setSeriesMeta(DEFAULT_META);
        setSeriesError(error.message || 'Failed to fetch series');
      }
    }

    run();
    return () => controller.abort();
  }, [activeTab]);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    };
  }, []);

  async function refreshBySeriesFallback() {
    try {
      const res = await fetch(`/api/dashboard/series?sub=${encodeURIComponent(activeTab)}&refresh=1`);
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setRefreshStatus(payload.error || '요청 실패');
        return;
      }
      const payload = await res.json();
      setSeries(payload.series || []);
      setSeriesMeta(payload.meta || DEFAULT_META);
      const status = getStatusFromMeta(payload.meta);
      setRefreshStatus(status || '완료');
    } catch (error) {
      console.error('Fallback refresh failed', error);
      setRefreshStatus('요청 실패');
    }
  }

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

      // If seed endpoint is unavailable on deployed env, fallback to series refresh queueing.
      if (res.status === 404) {
        await refreshBySeriesFallback();
        return;
      }

      const payload = await res.json().catch(() => ({}));
      if (res.ok && payload?.queued) {
        const queuedStatus = payload?.immediate ? '완료' : toStatusText(payload?.status || payload?.reason);
        setRefreshStatus(queuedStatus);
        if (payload?.immediate) {
          const data = await fetchSeriesForTab(activeTab);
          setSeries(data.series || []);
          setSeriesMeta(data.meta || DEFAULT_META);
          const status = getStatusFromMeta(data.meta);
          if (status) setRefreshStatus(status);
        }
      } else {
        setRefreshStatus(toStatusText(payload?.status || payload?.reason));
      }
    } catch (error) {
      console.error('Failed to refresh', error);
      setRefreshStatus('요청 실패');
    } finally {
      setRefreshing(false);
    }

    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = setTimeout(() => setRefreshStatus(''), 30000);
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
      <ScoreCard current={currentData} sourceTier={seriesMeta?.sourceTier} />
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
