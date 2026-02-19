'use client';

import styles from './SetupLayout.module.css';

export default function SetupLayout({
    step, // 1, 2, 3
    title,
    description,
    currentCount,
    totalCount, // Optional, if null, hide counter
    children,
    bottomContent // Button or other footer content
}) {
    const progressPercent = (step / 3) * 100;

    return (
        <div className={styles.layout}>
            <header className={styles.header}>
                <div className={styles.progressContainer}>
                    <div className={styles.progressRow}>
                        <span>진행 {step}/3</span>
                        {totalCount !== undefined && (
                            <span className={styles.progressCount}>
                                {currentCount}개 선택됨 / {totalCount}개
                            </span>
                        )}
                    </div>
                    <div className={styles.progressBar}>
                        <div
                            className={styles.progressFill}
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>
            </header>

            <main className={styles.main}>
                <h1 className={styles.title}>{title}</h1>
                {description && <p className={styles.description}>{description}</p>}

                {children}
            </main>

            <footer className={styles.footer}>
                <div className={styles.footerContent}>
                    {bottomContent}
                </div>
            </footer>
        </div>
    );
}
