"use client";

import { useState } from 'react';
import styles from './DemoGraph.module.css';

const MOCK_DATA = {
    '정치': { score: 24, comment: '이건 좀 아닌 것 같아요...', trend: [40, 35, 30, 28, 25, 24], color: 'red' },
    '경제': { score: 82, comment: '오, 분위기 좋은데요?', trend: [60, 65, 70, 75, 80, 82], color: 'green' },
    '사회': { score: 45, comment: '아직은 좀 애매합니다.', trend: [50, 48, 46, 45, 45, 45], color: 'yellow' },
    'IT/과학': { score: 91, comment: '혁신이 세상을 바꾸고 있어요!', trend: [70, 75, 80, 85, 90, 91], color: 'green' },
    '세계': { score: 18, comment: '전쟁과 갈등... 긴장되네요.', trend: [30, 25, 20, 15, 12, 18], color: 'red' },
};

export default function DemoGraph() {
    const [activeTab, setActiveTab] = useState('경제');
    const data = MOCK_DATA[activeTab];

    return (
        <div className={styles.wrapper}>
            <div className={styles.tabs}>
                {Object.keys(MOCK_DATA).map((key) => (
                    <button
                        key={key}
                        className={`${styles.tab} ${activeTab === key ? styles.active : ''}`}
                        onClick={() => setActiveTab(key)}
                    >
                        {key}
                    </button>
                ))}
            </div>

            <div className={styles.graphContainer}>
                <div className={styles.bars}>
                    {data.trend.map((val, idx) => (
                        <div key={idx} className={styles.barWrapper}>
                            <div
                                className={`${styles.bar} ${styles[data.color]}`}
                                style={{ height: `${val}%` }}
                            />
                        </div>
                    ))}
                </div>

                <div className={styles.overlay}>
                    <div className={styles.scoreContainer}>
                        <span className={`${styles.score} ${styles[data.color]}`}>{data.score}점</span>
                        <p className={styles.comment}>{data.comment}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
