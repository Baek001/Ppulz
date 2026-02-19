import Link from 'next/link';

import styles from '@/app/legal.module.css';

export const metadata = {
  title: '개인정보처리방침 | Ppulz',
};

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <Link href='/' className={styles.topLink}>
          ← 소개 페이지로 돌아가기
        </Link>

        <h1 className={styles.title}>개인정보처리방침</h1>
        <p className={styles.updated}>시행일: 2026년 2월 19일</p>

        <section className={styles.section}>
          <h2>1. 수집 항목</h2>
          <ul className={styles.list}>
            <li>이메일 주소</li>
            <li>인증 및 서비스 이용 기록</li>
            <li>온보딩 선택 정보 및 서비스 이용 로그</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>2. 이용 목적</h2>
          <p>
            회원 식별, 로그인/보안 처리, 맞춤형 대시보드 제공, 서비스 품질 개선을 위해 개인정보를
            이용합니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2>3. 보관 기간</h2>
          <p>
            관계 법령에 따른 보존 의무가 있는 경우를 제외하고, 회원 탈퇴 또는 목적 달성 시 지체 없이
            파기합니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2>4. 제3자 제공</h2>
          <p>
            원칙적으로 이용자 동의 없이 개인정보를 외부에 제공하지 않습니다. 단, 법령에 근거한 경우는
            예외로 합니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2>5. 문의</h2>
          <p>개인정보 관련 문의는 ppulsedata@gmail.com으로 접수할 수 있습니다.</p>
        </section>
      </div>
    </main>
  );
}

