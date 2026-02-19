export const runtime = 'edge';
import { redirect } from 'next/navigation';

import LeaderboardClient from '@/components/leaderboard/LeaderboardClient';
import SetupErrorState from '@/components/onboarding/SetupErrorState';
import { toOnboardingErrorMessage } from '@/lib/onboarding/errors';
import { requireUserWithOnboarding } from '@/lib/onboarding/guards';
import { isCompletedState } from '@/lib/onboarding/state';

export const metadata = {
  title: '由щ뜑蹂대뱶 | Ppulz',
};

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
  let onboarding;

  try {
    ({ onboarding } = await requireUserWithOnboarding());
  } catch (error) {
    return <SetupErrorState title='온보딩 테이블 미설정' message={toOnboardingErrorMessage(error)} />;
  }

  if (!isCompletedState(onboarding.onboarding_state)) {
    redirect('/setup/categories');
  }

  return <LeaderboardClient />;
}


