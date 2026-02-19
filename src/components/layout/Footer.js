import Link from 'next/link';

import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.container}`}>
        <div className={styles.top}>
          <div className={styles.brand}>
            <div className={styles.logo}>Ppulz</div>
            <p className={styles.desc}>
              뉴스/법안 데이터를 분석해
              <br />
              지금의 분위기를 점수로 보여주는 서비스
            </p>
          </div>
          <div className={styles.links}>
            <div className={styles.column}>
              <h4>서비스</h4>
              <a href='#features'>기능 소개</a>
              <a href='#how-it-works'>사용 방법</a>
              <a href='#prediction-market'>예측마켓</a>
            </div>
            <div className={styles.column}>
              <h4>지원</h4>
              <a href='#faq'>자주 묻는 질문</a>
              <a href='mailto:ppulsedata@gmail.com'>문의하기 (ppulsedata@gmail.com)</a>
            </div>
          </div>
        </div>
        <div className={styles.bottom}>
          <p>© 2024 Ppulz. All rights reserved.</p>
          <div className={styles.legal}>
            <Link href='/terms'>이용약관</Link>
            <Link href='/privacy'>개인정보처리방침</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

