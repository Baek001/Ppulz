'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from './Dashboard.module.css';

export default function DashboardHeader({ lastUpdated }) {
    const [userEmail, setUserEmail] = useState('');
    const [loggingOut, setLoggingOut] = useState(false);
    const router = useRouter();
    const dateString = lastUpdated ? new Date(lastUpdated).toLocaleString() : '데이터 없음';

    useEffect(() => {
        const supabase = createClient();
        let isMounted = true;

        async function loadSession() {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (isMounted) {
                setUserEmail(session?.user?.email || '');
            }
        }

        loadSession();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            if (isMounted) {
                setUserEmail(session?.user?.email || '');
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    async function handleLogout() {
        if (loggingOut) return;
        setLoggingOut(true);

        try {
            const supabase = createClient();
            await supabase.auth.signOut();
            router.push('/login');
            router.refresh();
        } finally {
            setLoggingOut(false);
        }
    }

    return (
        <header className={styles.header}>
            <div className={styles.topRow}>
                <h1 className={styles.logo}>Ppulz</h1>
                <div className={styles.userPanel}>
                    <span className={styles.userEmail}>{userEmail || '로그인 사용자'}</span>
                    <Link href='/markets' className={styles.marketBoardBtn}>
                        마켓 보드
                    </Link>
                    <Link href='/leaderboard' className={styles.leaderboardBtn}>
                        리더보드
                    </Link>
                    <Link href='/setup/categories?edit=1' className={styles.editCategoriesBtn}>
                        카테고리 수정
                    </Link>
                    <button
                        type='button'
                        onClick={handleLogout}
                        className={styles.logoutBtn}
                        disabled={loggingOut}
                    >
                        {loggingOut ? '로그아웃 중...' : '로그아웃'}
                    </button>
                </div>
            </div>
            <p className={styles.lastUpdated}>마지막 분석: {dateString}</p>
        </header>
    );
}

