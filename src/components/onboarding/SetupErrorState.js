import styles from './Onboarding.module.css';

export default function SetupErrorState({ title = '온보딩 설정 오류', message }) {
  return (
    <div className={styles.page}>
      <section className={styles.container}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.error}>{message}</p>
        <p className={styles.description}>
          Supabase SQL Editor에서 `supabase/migrations/20260219_onboarding.sql` 내용을 실행한 뒤,
          개발 서버를 재시작하고 다시 시도해주세요.
        </p>
      </section>
    </div>
  );
}
