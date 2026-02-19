'use client';

import styles from './ReferenceSection.module.css';

export default function ReferenceSection({ references }) {
    const safeReferences = Array.isArray(references) ? references : [];
    const newsRefs = safeReferences.filter((item) => item?.source_type === 'news');
    const billRefs = safeReferences.filter((item) => item?.source_type === 'bill');
    const visibleNews = newsRefs.slice(0, 4);
    const visibleBills = billRefs.slice(0, 2);

    return (
        <div className={styles.container}>
            <section className={styles.newsSection}>
                <h3 className={styles.title}>관련 뉴스 (News)</h3>
                <div className={styles.newsGrid}>
                    {visibleNews.length > 0 ? (
                        visibleNews.map((ref, idx) => (
                            <a
                                key={idx}
                                href={ref.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.newsCard}
                            >
                                <div className={styles.provider}>뉴스</div>
                                <div className={styles.newsText}>{ref.title}</div>
                            </a>
                        ))
                    ) : (
                        <div className={styles.empty}>관련 뉴스가 없습니다.</div>
                    )}
                </div>
            </section>

            <section className={styles.billsSection}>
                <h3 className={styles.title}>관련 법안/규제 (Bills)</h3>
                <div className={styles.billsList}>
                    {visibleBills.length > 0 ? (
                        visibleBills.map((ref, idx) => (
                            <a
                                key={idx}
                                href={ref.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.billRow}
                            >
                                <span className={styles.billDot}>•</span>
                                <span className={styles.billText}>{ref.title}</span>
                            </a>
                        ))
                    ) : (
                        <div className={styles.emptyCompact}>관련 법안/규제가 없습니다.</div>
                    )}
                </div>
            </section>
        </div>
    );
}
