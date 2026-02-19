import styles from './PredictionMarketIntro.module.css';

const ITEMS = [
  {
    title: '상승/하락 즉시 예측',
    desc: '대시보드에서 현재 카테고리 흐름을 보고 바로 상승/하락을 선택할 수 있습니다.',
  },
  {
    title: '참여 포인트 규칙',
    desc: '참여할 때마다 100P가 사용되며, 같은 방향에는 추가 참여가 가능합니다.',
  },
  {
    title: '자동 정산',
    desc: '24시간 뒤 Ppulz 점수 변화를 기준으로 결과가 자동 정산됩니다.',
  },
  {
    title: '주간 리더보드',
    desc: '주간 누적 성과를 기준으로 상위 참여자를 한눈에 확인할 수 있습니다.',
  },
];

const ADVANCED_METRICS = [
  {
    icon: '🧪',
    badge: '신뢰',
    hint: '표본 수 기반 등급',
    title: '표본 신뢰도',
    desc: '참여 표 수를 기준으로 신뢰 수준을 낮음·보통·높음으로 표시합니다.',
  },
  {
    icon: '〰️',
    badge: '변화성',
    hint: '요동 빈도·폭 반영',
    title: '변동성',
    desc: '최근 구간에서 확률이 얼마나 자주, 크게 흔들렸는지 나타냅니다.',
  },
  {
    icon: '⚖️',
    badge: '균형',
    hint: '50:50에 가까울수록 상승',
    title: '논쟁도',
    desc: '상승·하락 비율이 50:50에 가까울수록 논쟁도가 높다고 판단합니다.',
  },
  {
    icon: '⚡',
    badge: '알림',
    hint: '최근 ±10%p 급변 포착',
    title: '급변 탐지',
    desc: '직전 대비 확률 변화폭이 큰 경우를 감지해 급격한 분위기 전환을 알려줍니다.',
  },
  {
    icon: '🧭',
    badge: '종합',
    hint: '질문 단위가 아닌 카테고리 단위',
    title: '카테고리 군중지수',
    desc: '개별 질문이 아닌 카테고리 전체의 종합 군중 심리를 하나의 지수로 보여줍니다.',
  },
];

export default function PredictionMarketIntro() {
  return (
    <section id='prediction-market' className={styles.section}>
      <div className={`container ${styles.container}`}>
        <h2 className={styles.title}>예측 마켓</h2>
        <p className={styles.subtitle}>뉴스와 법안 신호를 보고 다음 점수 방향을 직접 예측해보세요.</p>

        <article className={styles.mockWrap}>
          <div className={styles.mockHeader}>
            <span className={styles.mockTitle}>예측 마켓 예시 화면</span>
            <span className={styles.mockBalance}>보유 1000P</span>
          </div>

          <div className={styles.mockCard}>
            <div className={styles.mockTop}>
              <strong>재건축 점수 24시간 후 상승할까요?</strong>
              <span>23시간 44분 남음</span>
            </div>

            <div className={styles.mockBar}>
              <span className={styles.mockBarUp} />
              <span className={styles.mockBarDown} />
            </div>

            <div className={styles.mockMeta}>
              <span>상승 65%</span>
              <span>하락 35%</span>
              <span>풀 2,400P</span>
            </div>

            <div className={styles.mockButtons}>
              <span className={styles.mockBtnUp}>상승 예측</span>
              <span className={styles.mockBtnDown}>하락 예측</span>
            </div>

            <p className={styles.mockFoot}>내 선택: 상승 (300P)</p>
          </div>
        </article>

        <div className={styles.grid}>
          {ITEMS.map((item) => (
            <article key={item.title} className={styles.card}>
              <h3 className={styles.cardTitle}>{item.title}</h3>
              <p className={styles.cardDesc}>{item.desc}</p>
            </article>
          ))}
        </div>

        <section className={styles.advancedSection}>
          <div className={styles.advancedPanel}>
            <h3 className={styles.advancedTitle}>고급 지표 예시</h3>
            <p className={styles.advancedSubtitle}>
              단일 질문 결과를 넘어, 군중 신호의 안정성·변화성·집중도를 함께 해석할 수 있습니다.
            </p>

            <div className={styles.advancedGrid}>
              {ADVANCED_METRICS.map((metric) => (
                <article key={metric.title} className={styles.advancedCard}>
                  <div className={styles.advancedCardHead}>
                    <span className={styles.metricIcon}>{metric.icon}</span>
                    <span className={styles.metricBadge}>{metric.badge}</span>
                  </div>
                  <h4 className={styles.advancedCardTitle}>{metric.title}</h4>
                  <p className={styles.advancedCardDesc}>{metric.desc}</p>
                  <p className={styles.metricHint}>{metric.hint}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

