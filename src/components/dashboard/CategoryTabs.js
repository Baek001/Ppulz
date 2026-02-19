'use client';

import styles from './Dashboard.module.css';

export default function CategoryTabs({
    tabs,
    activeTab,
    onTabChange,
    onRefresh,
    refreshing,
    refreshDisabled,
    refreshStatus,
    stale
}) {
    if (!tabs || tabs.length === 0) return null;

    return (
        <div className={styles.tabsBar}>
            <div className={styles.tabsScroller}>
                {tabs.map((tab) => (
                    <button
                        key={tab}
                        className={`${styles.tabBtn} ${activeTab === tab ? styles.active : ''}`}
                        onClick={() => onTabChange(tab)}
                    >
                        {tab}
                    </button>
                ))}
            </div>
            <div className={styles.tabsActions}>
                {stale ? <span className={styles.staleBadge}>데이터 오래됨</span> : null}
                {refreshStatus ? <span className={styles.refreshBadge}>{refreshStatus}</span> : null}
                <button
                    type='button'
                    className={styles.refreshBtn}
                    onClick={onRefresh}
                    disabled={refreshDisabled}
                >
                    {refreshing ? '요청 중...' : '새로고침'}
                </button>
            </div>
        </div>
    );
}
