export const runtime = 'edge';
import AuthPage from '@/components/auth/AuthPage';

export const metadata = {
  title: '회원가입 | Ppulz',
};

export default function SignupPage() {
  return <AuthPage mode='signup' />;
}


