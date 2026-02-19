'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from './Header.module.css';

export default function UserMenu() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        // Check active session
        async function checkUser() {
            const { data: { session } } = await supabase.auth.getSession();
            setUser(session?.user ?? null);
            setLoading(false);
        }

        checkUser();

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [supabase]);

    async function handleLogout() {
        await supabase.auth.signOut();
        router.refresh();
    }

    // Prevent hydration mismatch or flickering by rendering nothing or a placeholder while loading
    // For header, often it's better to show nothing or a specific loading state
    if (loading) {
        return <div className={styles.actions} style={{ opacity: 0 }}>...</div>;
    }

    if (user) {
        return (
            <div className={styles.actions}>
                <Link href="/markets" className={styles.actionGhost}>
                    마켓보드
                </Link>
                <button onClick={handleLogout} className={styles.actionGhost}>
                    로그아웃
                </button>
                <Link href="/dashboard" className={styles.actionPrimary}>
                    대시보드
                </Link>
            </div>
        );
    }

    return (
        <div className={styles.actions}>
            <Link href='/markets' className={styles.actionGhost}>
                마켓보드
            </Link>
            <Link href='/login' className={styles.actionGhost}>
                로그인
            </Link>
            <Link href='/signup' className={styles.actionPrimary}>
                시작하기
            </Link>
        </div>
    );
}
