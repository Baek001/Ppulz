import { redirect } from 'next/navigation';

import SetupErrorState from '@/components/onboarding/SetupErrorState';
import SubcategoriesStep from '@/components/onboarding/SubcategoriesStep';
import { toOnboardingErrorMessage } from '@/lib/onboarding/errors';
import {
  hasThreeBigCategories,
  requireUserWithOnboarding,
} from '@/lib/onboarding/guards';
import { isCompletedState } from '@/lib/onboarding/state';

export const metadata = {
  title: '소분류 선택 | Ppulz',
};

export const dynamic = 'force-dynamic';

export default async function SubcategoriesPage({ searchParams }) {
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

  if (!hasThreeBigCategories(onboarding)) {
    redirect(editMode ? '/setup/categories?edit=1' : '/setup/categories');
  }

  return (
    <SubcategoriesStep
      bigCategories={onboarding.big_categories}
      initialSelections={onboarding.sub_categories}
      editMode={editMode}
    />
  );
}

