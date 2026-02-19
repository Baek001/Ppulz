'use client';

import { useEffect } from 'react';
import styles from './page.module.css';
import Button from '@/components/ui/Button';

export default function Error({ error, reset }) {
    useEffect(() => {
        console.error('Dashboard Error:', error);
    }, [error]);

    return (
        <div className={styles.page} style={{ padding: '40px', textAlign: 'center' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '10px' }}>
                대시보드를 불러오는 중 오류가 발생했습니다.
            </h2>
            <p style={{ color: 'red', marginBottom: '20px', wordBreak: 'break-all' }}>
                {error?.message || '알 수 없는 오류'}
            </p>
            <Button onClick={() => reset()}>다시 시도</Button>
        </div>
    );
}
