'use client';

import styles from './Dashboard.module.css';

function getScoreColorClass(score) {
    if (score >= 63) return styles.scoreGreen; // Positive
    if (score >= 40) return styles.scoreYellow; // Neutral
    return styles.scoreRed; // Negative
}

function sourceTierText(sourceTier, activeCategory) {
    if (!sourceTier || sourceTier === 'category') return '';
    const categoryLabel = activeCategory || '선택 카테고리';
    return `보강 데이터(${categoryLabel})`;
}

export default function ScoreCard({ current, sourceTier, activeCategory }) {
    if (!current) {
        return (
            <div className={styles.scoreCard}>
                <p style={{ color: '#8b95a1' }}>아직 분석 데이터가 없습니다.</p>
            </div>
        );
    }

    const { score, label, comment } = current;
    const colorClass = getScoreColorClass(score);

    return (
        <div className={styles.scoreCard}>
            <div className={styles.scoreLabel}>
                {label || '분석 중'}
            </div>
            <div className={`${styles.scoreValue} ${colorClass}`}>
                {score ?? '-'}
            </div>
            <p className={styles.scoreComment}>
                {comment || '아직 AI 분석 코멘트가 없습니다.'}
            </p>
            {sourceTier && sourceTier !== 'category' ? (
                <p style={{ marginTop: '8px', fontSize: '12px', color: '#8b95a1' }}>
                    {sourceTierText(sourceTier, activeCategory)}
                </p>
            ) : null}
        </div>
    );
}
