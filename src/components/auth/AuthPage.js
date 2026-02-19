'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import Button from '@/components/ui/Button';
import { createClient, hasSupabasePublicEnv } from '@/lib/supabase/client';

import styles from './AuthPage.module.css';

function buildRedirectTo() {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return `${window.location.origin}/auth/callback`;
}

function resolveAuthErrorMessage(error) {
  const message = error?.message ?? '';

  if (message.includes('Supabase 환경변수가 없습니다')) {
    return 'Supabase 환경변수가 설정되지 않았습니다. .env.local에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY를 추가한 뒤 서버를 재시작하세요.';
  }

  return message || '요청 처리 중 오류가 발생했습니다.';
}

export default function AuthPage({ mode }) {
  const router = useRouter();
  const isLogin = mode === 'login';
  const supabaseReady = hasSupabasePublicEnv();

  const title = useMemo(() => (isLogin ? '로그인' : '회원가입'), [isLogin]);
  const subtitle = useMemo(
    () => (isLogin ? 'Ppulz 계정으로 로그인하세요.' : 'Ppulz 계정을 만들고 온보딩을 시작하세요.'),
    [isLogin],
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  async function handleEmailAuth(event) {
    event.preventDefault();

    setPending(true);
    setErrorMessage('');
    setInfoMessage('');

    try {
      // if (!supabaseReady) {
      //   throw new Error('Supabase 환경변수가 없습니다.');
      // }

      if (!isLogin && password !== confirmPassword) {
        throw new Error('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      }

      const supabase = createClient();

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
          throw error;
        }

        router.replace('/setup/categories');
        router.refresh();
        return;
      }

      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || '회원가입 처리 중 오류가 발생했습니다.');
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        throw signInError;
      }

      router.replace('/setup/categories');
      router.refresh();
    } catch (error) {
      setErrorMessage(resolveAuthErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  async function handleGoogleAuth() {
    setPending(true);
    setErrorMessage('');
    setInfoMessage('');

    try {
      // if (!supabaseReady) {
      //   throw new Error('Supabase 환경변수가 없습니다.');
      // }

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: buildRedirectTo(),
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      setErrorMessage(resolveAuthErrorMessage(error));
      setPending(false);
    }
  }

  return (
    <main className={styles.wrapper}>
      <div className={styles.center}>
        <section className={styles.card}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>



          <form onSubmit={handleEmailAuth} className={styles.form}>
            <label className={styles.label} htmlFor='email'>
              이메일
            </label>
            <input
              id='email'
              className={styles.input}
              type='email'
              autoComplete='email'
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />

            <label className={styles.label} htmlFor='password'>
              비밀번호
            </label>
            <input
              id='password'
              className={styles.input}
              type='password'
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />

            {!isLogin ? (
              <>
                <label className={styles.label} htmlFor='confirm-password'>
                  비밀번호 확인
                </label>
                <input
                  id='confirm-password'
                  className={styles.input}
                  type='password'
                  autoComplete='new-password'
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  minLength={8}
                  required
                />
              </>
            ) : null}

            <Button type='submit' fullWidth disabled={pending}>
              {pending ? '처리 중...' : isLogin ? '이메일로 로그인' : '이메일로 가입'}
            </Button>
          </form>

          <p className={styles.divider}>또는</p>

          <Button
            variant='outline'
            fullWidth
            disabled={pending}
            onClick={handleGoogleAuth}
          >
            Google로 계속하기
          </Button>

          {errorMessage ? <p className={`${styles.message} ${styles.error}`}>{errorMessage}</p> : null}
          {infoMessage ? <p className={`${styles.message} ${styles.success}`}>{infoMessage}</p> : null}

          <p className={styles.footer}>
            {isLogin ? '계정이 없나요? ' : '이미 계정이 있나요? '}
            <Link href={isLogin ? '/signup' : '/login'}>{isLogin ? '회원가입' : '로그인'}</Link>
          </p>
        </section>
      </div>
    </main>
  );
}

