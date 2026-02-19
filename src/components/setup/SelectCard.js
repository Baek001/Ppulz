'use client';

import styles from './SelectCard.module.css';

// Simple check icon SVG
const CheckIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="currentColor" />
        <path d="M7 12L10.5 15.5L17 9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export default function SelectCard({
    label,
    selected,
    onClick,
    disabled = false
}) {
    return (
        <button
            type="button"
            className={`${styles.card} ${selected ? styles.selected : ''} ${disabled ? styles.disabled : ''}`}
            onClick={disabled ? undefined : onClick}
            disabled={disabled}
        >
            <span className={styles.label}>{label}</span>
            <span className={styles.subLabel}>{selected ? '선택됨' : '선택하기'}</span>

            <div className={styles.checkIcon}>
                <CheckIcon />
            </div>
        </button>
    );
}
