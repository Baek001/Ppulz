import styles from './Trust.module.css';

export default function Trust() {
  return (
    <section id='faq' className={styles.section}>
      <div className={`container ${styles.container}`}>
        <h2 className={styles.sectionTitle}>
          Ppulz를 신뢰할 수 있는
          <br />
          <span className={styles.highlight}>뉴스/법안 분석 근거</span>
        </h2>

        <div className={styles.content}>
          <p className={styles.desc}>
            Ppulz는 뉴스 기사와 법안 데이터를 자연어 처리(NLP)로 분석해
            <br />
            사용자가 이해하기 쉬운 요약과 신호를 제공합니다.
          </p>

          <div className={styles.disclaimerBox}>
            <strong className={styles.disclaimerTitle}>면책 조항</strong>
            <p className={styles.disclaimerText}>
              본 서비스의 정보는 참고 자료이며 투자 또는 정책 판단의 최종 책임은 사용자에게 있습니다.
              <br />
              Ppulz는 서비스 이용 결과에 대한 법적 책임을 지지 않습니다.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

