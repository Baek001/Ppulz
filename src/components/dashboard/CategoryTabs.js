'use client';

import styles from './Dashboard.module.css';

export default function CategoryTabs({ tabs, activeTab, onTabChange }) {
    if (!tabs || tabs.length === 0) return null;

    return (
        <div className={styles.tabsContainer}>
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
    );
}
