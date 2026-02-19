import Link from 'next/link';

import styles from '@/app/legal.module.css';

export const metadata = {
  title: '이용약관 | Ppulz',
};

export default function TermsPage() {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <Link href='/' className={styles.topLink}>
          ← 소개 페이지로 돌아가기
        </Link>

        <h1 className={styles.title}>이용약관</h1>
        <p className={styles.updated}>시행일: 2026년 2월 19일</p>

        <section className={styles.section}>
          <h2>1. 목적</h2>
          <p>
            본 약관은 Ppulz(이하 &quot;서비스&quot;)의 이용과 관련하여 회사와 이용자 간 권리, 의무 및 책임사항을
            규정함을 목적으로 합니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2>2. 서비스 제공 내용</h2>
          <ul className={styles.list}>
            <li>뉴스/법안 기반 분위기 점수 및 코멘트 제공</li>
            <li>카테고리별 대시보드 및 예측 마켓 기능 제공</li>
            <li>랭킹 및 통계 정보 제공</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>3. 이용자 의무</h2>
          <p>
            이용자는 관련 법령 및 본 약관을 준수해야 하며, 서비스의 정상 운영을 방해하는 행위를 해서는
            안 됩니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2>4. 면책</h2>
          <p>
            서비스에서 제공되는 정보는 참고용이며, 투자 및 의사결정의 최종 책임은 이용자에게 있습니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2>5. 약관 변경</h2>
          <p>
            회사는 필요 시 약관을 변경할 수 있으며, 변경 사항은 서비스 내 공지 후 효력이 발생합니다.
          </p>
        </section>
      </div>
    </main>
  );
}

