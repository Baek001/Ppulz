import { NextResponse } from 'next/server';
import { z } from 'zod';

import { isValidSubCategory } from '@/lib/constants/categories';
import { getOrCreateOnboardingRow } from '@/lib/onboarding/guards';
import { ONBOARDING_STATES } from '@/lib/onboarding/state';
import { createClient } from '@/lib/supabase/server';

const selectionSchema = z.object({
  big_category: z.string(),
  sub_category: z.string(),
});

const requestSchema = z.object({
  onePickBigCategory: z.string(),
  selections: z.array(selectionSchema).length(5),
});

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const onboarding = await getOrCreateOnboardingRow(supabase, user.id);

    if (onboarding.big_categories.length !== 3) {
      return NextResponse.json({ error: '대분류 3개 선택이 먼저 필요합니다.' }, { status: 400 });
    }

    const { onePickBigCategory, selections } = parsed.data;

    if (!onboarding.big_categories.includes(onePickBigCategory)) {
      return NextResponse.json({ error: '1개 제한 대분류가 유효하지 않습니다.' }, { status: 400 });
    }

    const uniquePairSet = new Set(selections.map((item) => `${item.big_category}::${item.sub_category}`));
    if (uniquePairSet.size !== selections.length) {
      return NextResponse.json({ error: '소분류 중복 선택은 허용되지 않습니다.' }, { status: 400 });
    }

    const countByBigCategory = new Map(onboarding.big_categories.map((bigCategory) => [bigCategory, 0]));

    for (const selection of selections) {
      if (!onboarding.big_categories.includes(selection.big_category)) {
        return NextResponse.json(
          { error: `${selection.big_category}는 선택된 대분류가 아닙니다.` },
          { status: 400 },
        );
      }

      if (!isValidSubCategory(selection.big_category, selection.sub_category)) {
        return NextResponse.json(
          { error: `${selection.sub_category}는 ${selection.big_category}의 유효한 소분류가 아닙니다.` },
          { status: 400 },
        );
      }

      countByBigCategory.set(selection.big_category, (countByBigCategory.get(selection.big_category) ?? 0) + 1);
    }

    const onePickCount = countByBigCategory.get(onePickBigCategory) ?? 0;
    if (onePickCount !== 1) {
      return NextResponse.json({ error: '1개 제한 대분류는 정확히 1개여야 합니다.' }, { status: 400 });
    }

    const invalidTwoPick = onboarding.big_categories
      .filter((bigCategory) => bigCategory !== onePickBigCategory)
      .some((bigCategory) => (countByBigCategory.get(bigCategory) ?? 0) !== 2);

    if (invalidTwoPick) {
      return NextResponse.json({ error: '나머지 2개 대분류는 각각 2개씩 선택해야 합니다.' }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from('user_onboarding')
      .update({
        sub_categories: selections,
        example_checked: [],
        onboarding_state: ONBOARDING_STATES.SUBCATEGORIES_SELECTED,
      })
      .eq('user_id', user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error?.message ?? '소분류 저장 실패' }, { status: 500 });
  }
}
