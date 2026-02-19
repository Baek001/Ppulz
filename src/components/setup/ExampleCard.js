'use client';

import styles from './ExampleCard.module.css';

// Check Icon (checkmark only)
const CheckIcon = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 7L5.5 10.5L12 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

function toLabel(type) {
    if (type === 'news') return '뉴스';
    if (type === 'bill') return '법안';
    return type;
}

export default function ExampleCard({
    type, // 'news' | 'bill' (or others)
    category, // '경제/금융'
    title,
    description,
    selected,
    onClick
}) {
    return (
        <article
            className={`${styles.card} ${selected ? styles.selected : ''}`}
            data-type={type}
            onClick={onClick}
        >
            <div className={styles.header}>
                <span className={styles.badge}>{toLabel(type)}</span>
                <span className={styles.category}>{category}</span>
            </div>

            <h3 className={styles.title}>{title}</h3>
            <p className={styles.description}>{description}</p>

            <div className={styles.checkOverlay}>
                <div className={styles.checkIcon}>
                    <CheckIcon />
                </div>
            </div>
        </article>
    );
}
