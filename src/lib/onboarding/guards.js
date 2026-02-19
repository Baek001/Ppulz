import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { ONBOARDING_STATES, normalizeArray } from '@/lib/onboarding/state';
import { BIG_CATEGORIES, isValidBigCategory, isValidSubCategory } from '@/lib/constants/categories';

function buildDefaultOnboardingRow(userId) {
  return {
    user_id: userId,
    big_categories: [],
    sub_categories: [],
    example_checked: [],
    onboarding_state: ONBOARDING_STATES.CATEGORIES_SELECTED,
  };
}

function normalizeSubCategories(value) {
  const items = normalizeArray(value);

  return items
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      big_category: item.big_category,
      sub_category: item.sub_category,
    }))
    .filter(
      (item) =>
        typeof item.big_category === 'string' &&
        typeof item.sub_category === 'string' &&
        isValidBigCategory(item.big_category) &&
        isValidSubCategory(item.big_category, item.sub_category),
    );
}

function normalizeOnboardingRow(row) {
  return {
    ...row,
    big_categories: normalizeArray(row?.big_categories).filter((item) => isValidBigCategory(item)),
    sub_categories: normalizeSubCategories(row?.sub_categories),
    example_checked: normalizeArray(row?.example_checked).filter((item) => typeof item === 'string'),
    onboarding_state:
      row?.onboarding_state && typeof row.onboarding_state === 'string'
        ? row.onboarding_state
        : ONBOARDING_STATES.CATEGORIES_SELECTED,
  };
}

function isNoRowsError(error) {
  return error?.code === 'PGRST116';
}

function isDuplicateKeyError(error) {
  if (!error) return false;
  if (error.code === '23505') return true;
  return String(error.message || '').toLowerCase().includes('duplicate key');
}

export async function getOrCreateOnboardingRow(supabase, userId) {
  const { data, error } = await supabase
    .from('user_onboarding')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    throw new Error(`Failed to load onboarding row: ${error.message}`);
  }

  if (data) {
    return normalizeOnboardingRow(data);
  }

  const { error: insertError } = await supabase
    .from('user_onboarding')
    .upsert(buildDefaultOnboardingRow(userId), { onConflict: 'user_id', ignoreDuplicates: true });

  const { data: retried, error: retryError } = await supabase
    .from('user_onboarding')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (retryError || !retried) {
    throw new Error(
      insertError?.message ?? retryError?.message ?? 'Failed to create onboarding row.',
    );
  }

  return normalizeOnboardingRow(retried);
}

export function hasThreeBigCategories(onboarding) {
  return onboarding.big_categories.length === 3;
}

export function hasFiveSubCategories(onboarding) {
  return onboarding.sub_categories.length === 5;
}

export function findOnePickBigCategory(subCategories, bigCategories) {
  const countByBig = new Map(bigCategories.map((bigCategory) => [bigCategory, 0]));

  subCategories.forEach((item) => {
    countByBig.set(item.big_category, (countByBig.get(item.big_category) ?? 0) + 1);
  });

  for (const bigCategory of bigCategories) {
    if ((countByBig.get(bigCategory) ?? 0) === 1) {
      return bigCategory;
    }
  }

  return bigCategories[0] ?? BIG_CATEGORIES[0];
}

export async function requireUserWithOnboarding() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const onboarding = await getOrCreateOnboardingRow(supabase, user.id);

  return { supabase, user, onboarding };
}

export function sanitizeCheckedCardIds(checkedCardIds, cards) {
  const cardIdSet = new Set(cards.map((card) => card.card_id));
  return normalizeArray(checkedCardIds).filter((cardId) => typeof cardId === 'string' && cardIdSet.has(cardId));
}
