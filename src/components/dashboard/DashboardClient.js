'use client';

import { useState, useEffect } from 'react';
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
                    return;
                }
                const payload = await res.json().catch(() => ({}));
                setSeries([]);
                setSeriesError(payload.error || 'Failed to fetch series');
            } catch (error) {
                if (error?.name === 'AbortError') {
                    return;
                }
                console.error('Failed to fetch series', error);
                setSeries([]);
                setSeriesError('Failed to fetch series');
            }
        }

        fetchSeries();

        return () => {
            controller.abort();
        };
    }, [activeTab]);

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
