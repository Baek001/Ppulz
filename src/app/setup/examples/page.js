import { redirect } from 'next/navigation';

import ExamplesStep from '@/components/onboarding/ExamplesStep';
import SetupErrorState from '@/components/onboarding/SetupErrorState';
import styles from '@/components/onboarding/Onboarding.module.css';
import { toOnboardingErrorMessage } from '@/lib/onboarding/errors';
import {
  hasFiveSubCategories,
  hasThreeBigCategories,
  requireUserWithOnboarding,
  sanitizeCheckedCardIds,
} from '@/lib/onboarding/guards';
import { selectExampleCards } from '@/lib/onboarding/exampleSelection';
import { isCompletedState } from '@/lib/onboarding/state';

export const metadata = {
  title: '예시 카드 체크 | Ppulz',
};

export const dynamic = 'force-dynamic';

export default async function ExamplesPage({ searchParams }) {
  const params = await searchParams;
  const editMode = params?.edit === '1';
  let supabase;
  let onboarding;

  try {
    ({ supabase, onboarding } = await requireUserWithOnboarding());
  } catch (error) {
    return <SetupErrorState title='온보딩 테이블 미설정' message={toOnboardingErrorMessage(error)} />;
  }

  if (isCompletedState(onboarding.onboarding_state) && !editMode) {
    redirect('/dashboard');
  }

  if (!hasThreeBigCategories(onboarding)) {
    redirect(editMode ? '/setup/categories?edit=1' : '/setup/categories');
  }

  if (!hasFiveSubCategories(onboarding)) {
    redirect(editMode ? '/setup/subcategories?edit=1' : '/setup/subcategories');
  }

  const { data: candidates, error } = await supabase
    .from('example_cards')
    .select(
      'card_id, card_type, big_category, sub_category, title, description, default_label, country_hint, bill_stage, version',
    )
    .in('big_category', onboarding.big_categories);

  if (error || !candidates) {
    return (
      <div className={styles.page}>
        <section className={styles.container}>
          <h1 className={styles.title}>예시 카드 로딩 실패</h1>
          <p className={styles.error}>example_cards 조회에 실패했습니다. import 상태를 확인해주세요.</p>
        </section>
      </div>
    );
  }

  let selectedCards;

  try {
    selectedCards = selectExampleCards(candidates, onboarding.sub_categories);
  } catch (selectionError) {
    return (
      <div className={styles.page}>
        <section className={styles.container}>
          <h1 className={styles.title}>예시 카드 구성 실패</h1>
          <p className={styles.error}>{selectionError.message}</p>
        </section>
      </div>
    );
  }

  const initialChecked = sanitizeCheckedCardIds(onboarding.example_checked, selectedCards);

  return <ExamplesStep cards={selectedCards} initialChecked={initialChecked} />;
}

