import Link from 'next/link';
import styles from './Hero.module.css';
import buttonStyles from '../ui/Button.module.css';
import Button from '../ui/Button';
import DemoGraph from './DemoGraph';
import { createClient } from '@/lib/supabase/server';

export default async function Hero() {
    let startHref = '/signup';

    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (user) {
            startHref = '/dashboard';
        }
    } catch {
        startHref = '/signup';
    }

    return (
        <section className={styles.hero}>
            <div className={`container ${styles.container}`}>
                <div className={styles.content}>
                    <h1 className={styles.title}>
                        지금 세상 분위기<br />
                        <span className={styles.highlight}>숫자 하나</span>로 읽으세요
                    </h1>
                    <p className={styles.description}>
                        복잡한 뉴스, 챙기기 힘든 법안 변화까지<br />
                        Ppulz가 분석한 명확한 점수와 코멘트로 확인하세요.
                    </p>
                    <div className={styles.actions}>
                        <Link
                            href={startHref}
                            className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.lg} ${styles.startButton}`}
                        >
                            시작하기
                        </Link>
                        <Button size="lg" variant="outline">
                            데모
                        </Button>
                    </div>
                </div>
                <div className={styles.visual}>
                    <DemoGraph />
                </div>
            </div>
        </section>
    );
}

