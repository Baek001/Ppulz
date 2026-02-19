export const runtime = 'edge';
import { redirect } from 'next/navigation';

import MarketDetailClient from '@/components/markets/MarketDetailClient';
import SetupErrorState from '@/components/onboarding/SetupErrorState';
import { toOnboardingErrorMessage } from '@/lib/onboarding/errors';
import { requireUserWithOnboarding } from '@/lib/onboarding/guards';
import { isCompletedState } from '@/lib/onboarding/state';

export const metadata = {
  title: '留덉폆 ?곸꽭 | Ppulz',
};

export const dynamic = 'force-dynamic';

export default async function MarketDetailPage({ params }) {
  const { id } = await params;
  let onboarding;

  try {
    ({ onboarding } = await requireUserWithOnboarding());
  } catch (error) {
    return <SetupErrorState title='온보딩 테이블 미설정' message={toOnboardingErrorMessage(error)} />;
  }

  if (!isCompletedState(onboarding.onboarding_state)) {
    redirect('/setup/categories');
  }

  return <MarketDetailClient marketId={id} />;
}

