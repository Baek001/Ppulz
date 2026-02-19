export const runtime = 'edge';
import { redirect } from 'next/navigation';

import CategoriesStep from '@/components/onboarding/CategoriesStep';
import SetupErrorState from '@/components/onboarding/SetupErrorState';
import { toOnboardingErrorMessage } from '@/lib/onboarding/errors';
import { requireUserWithOnboarding } from '@/lib/onboarding/guards';
import { isCompletedState } from '@/lib/onboarding/state';

export const metadata = {
  title: '대분류 선택 | Ppulz',
};

export const dynamic = 'force-dynamic';

export default async function CategoriesPage({ searchParams }) {
  const params = await searchParams;
  const editMode = params?.edit === '1';
  let onboarding;

  try {
    ({ onboarding } = await requireUserWithOnboarding());
  } catch (error) {
    return <SetupErrorState title='온보딩 테이블 미설정' message={toOnboardingErrorMessage(error)} />;
  }

  if (isCompletedState(onboarding.onboarding_state) && !editMode) {
    redirect('/dashboard');
  }

  return <CategoriesStep initialSelected={onboarding.big_categories} editMode={editMode} />;
}


