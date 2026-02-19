import styles from './Features.module.css';

const FEATURES = [
    {
        title: "새로워진 뉴스 소비",
        desc: "자극적인 헤드라인에 지치셨나요?\n핵심만 콕 집어 세상의 흐름을 읽으세요."
    },
    {
        title: "한국/미국 정보 통합",
        desc: "국내 이슈부터 글로벌 트렌드까지,\nPpulz 하나로 모두 파악할 수 있습니다."
    },
    {
        title: "빈틈없는 업데이트",
        desc: "변화하는 여론과 법안의 움직임을\n실시간에 가깝게 포착합니다."
    },
    {
        title: "근거가 필요할 때만",
        desc: "원문과 출처는 클릭 한 번으로 확인하고,\n평소엔 직관적인 요약만 보세요."
    }
];

export default function Features() {
    return (
        <section id="features" className={styles.section}>
            <div className={`container ${styles.container}`}>
                <h2 className={styles.sectionTitle}>
                    왜 <span className={styles.logo}>Ppulz</span>여야 할까요?
                </h2>

                <div className={styles.grid}>
                    {FEATURES.map((item, idx) => (
                        <div key={idx} className={styles.card}>
                            <h3 className={styles.cardTitle}>{item.title}</h3>
                            <p className={styles.cardDesc}>{item.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
