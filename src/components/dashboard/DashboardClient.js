'use client';

import { useEffect, useRef, useState } from 'react';
import DashboardHeader from './DashboardHeader';
import CategoryTabs from './CategoryTabs';
import ScoreGraph from './ScoreGraph';
import ScoreCard from './ScoreCard';
import PredictionMarketSection from './PredictionMarketSection';
import ReferenceSection from './ReferenceSection';
import styles from './Dashboard.module.css';

export default function DashboardClient() {
    const [tabs, setTabs] = useState([]);
    const [activeTab, setActiveTab] = useState('');
    const [series, setSeries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [seriesError, setSeriesError] = useState('');
    const [seriesMeta, setSeriesMeta] = useState({ stale: false, lastAnalyzedAt: null, seedQueued: false });
    const [refreshing, setRefreshing] = useState(false);
    const [refreshStatus, setRefreshStatus] = useState('');
    const refreshTimeoutRef = useRef(null);

    // 1. Fetch Tabs on mount
    useEffect(() => {
        async function prewarmOtherTabs(tabsToWarm) {
            const maxConcurrency = 2;
            let cursor = 0;

            async function runWorker() {
                while (cursor < tabsToWarm.length) {
                    const currentIndex = cursor;
                    cursor += 1;
                    const tab = tabsToWarm[currentIndex];

                    try {
                        await fetch(`/api/dashboard/series?sub=${encodeURIComponent(tab)}`, { cache: 'no-store' });
                    } catch {
                        // Ignore warm-up failures; active tab fetch handles user-facing state.
                    }
                }
            }

            const workerCount = Math.min(maxConcurrency, tabsToWarm.length);
            await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
        }

        async function fetchTabs() {
            try {
                const res = await fetch('/api/dashboard/tabs', { cache: 'no-store' });
                if (res.ok) {
                    const data = await res.json();
                    setTabs(data.tabs || []);
                    if (data.tabs?.length > 0) {
                        setActiveTab(data.tabs[0]);
                        void prewarmOtherTabs(data.tabs.slice(1));
                    }
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

    // 2. Fetch Series when tab changes
    useEffect(() => {
        if (!activeTab) return;

        const controller = new AbortController();

        async function fetchSeries() {
            try {
                setSeriesError('');
                const res = await fetch(`/api/dashboard/series?sub=${encodeURIComponent(activeTab)}`, {
                    cache: 'no-store',
                    signal: controller.signal,
                });
                if (res.ok) {
                    const data = await res.json();
                    setSeries(data.series || []);
                    setSeriesMeta(data.meta || { stale: false, lastAnalyzedAt: null, seedQueued: false });
                    if (data?.meta?.seedQueued) {
                        setRefreshStatus('요청됨');
                    }
                    return;
                }
                const payload = await res.json().catch(() => ({}));
                setSeries([]);
                setSeriesError(payload.error || 'Failed to fetch series');
                setSeriesMeta({ stale: false, lastAnalyzedAt: null, seedQueued: false });
            } catch (error) {
                if (error?.name === 'AbortError') {
                    return;
                }
                console.error('Failed to fetch series', error);
                setSeries([]);
                setSeriesError('Failed to fetch series');
                setSeriesMeta({ stale: false, lastAnalyzedAt: null, seedQueued: false });
            }
        }

        fetchSeries();

        return () => {
            controller.abort();
        };
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
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ subCategory: activeTab }),
            });
            const payload = await res.json().catch(() => ({}));

            if (res.ok && payload?.queued) {
                setRefreshStatus('요청됨');
            } else if (payload?.reason === 'cooldown') {
                setRefreshStatus('잠시 후 다시');
            } else if (payload?.reason === 'processing') {
                setRefreshStatus('처리 중');
            } else {
                setRefreshStatus('요청 실패');
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

    // Get latest data point for the card
    const currentData = series.length > 0 ? series[series.length - 1] : null;

    if (loading) {
        return <div className={styles.page}>Loading...</div>;
    }

    return (
        <div className={styles.page}>
            <DashboardHeader
                lastUpdated={currentData?.timestamp}
            />

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
