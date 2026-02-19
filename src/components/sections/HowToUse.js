import styles from './HowToUse.module.css';

const STEPS = [
    {
        step: 1,
        title: "관심 주제 선택",
        desc: "경제, 정치, IT 등 8개 대분류 중\n가장 궁금한 3가지를 고르세요."
    },
    {
        step: 2,
        title: "디테일 설정",
        desc: "선택한 분야 안에서 구체적인\n소분류 5개를 핀포인트로 지정합니다."
    },
    {
        step: 3,
        title: "점수 확인",
        desc: "매시간 업데이트되는 '지금 분위기'를\n직관적인 그래프와 점수로 확인하세요."
    }
];

export default function HowToUse() {
    return (
        <section id="how-it-works" className={styles.section}>
            <div className={`container ${styles.container}`}>
                <h2 className={styles.sectionTitle}>
                    복잡한 과정 없이,<br />
                    <span className={styles.highlight}>딱 3단계</span>로 끝납니다
                </h2>

                <div className={styles.grid}>
                    {STEPS.map((item) => (
                        <div key={item.step} className={styles.card}>
                            <div className={styles.stepNum}>{item.step}</div>
                            <h3 className={styles.cardTitle}>{item.title}</h3>
                            <p className={styles.cardDesc}>{item.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
