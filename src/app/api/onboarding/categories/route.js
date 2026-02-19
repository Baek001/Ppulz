export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { BIG_CATEGORIES } from '@/lib/constants/categories';
import { getOrCreateOnboardingRow } from '@/lib/onboarding/guards';
import { ONBOARDING_STATES } from '@/lib/onboarding/state';
import { createClient } from '@/lib/supabase/server';

const requestSchema = z.object({
  bigCategories: z.array(z.string()).length(3),
});

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 });
    }

    const uniqueBigCategories = [...new Set(parsed.data.bigCategories)];

    if (uniqueBigCategories.length !== 3) {
      return NextResponse.json({ error: '대분류는 중복 없이 3개여야 합니다.' }, { status: 400 });
    }

    const hasInvalidCategory = uniqueBigCategories.some(
      (bigCategory) => !BIG_CATEGORIES.includes(bigCategory),
    );

    if (hasInvalidCategory) {
      return NextResponse.json({ error: '허용되지 않은 대분류가 포함되어 있습니다.' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    await getOrCreateOnboardingRow(supabase, user.id);

    const { error: updateError } = await supabase
      .from('user_onboarding')
      .update({
        big_categories: uniqueBigCategories,
        sub_categories: [],
        example_checked: [],
        onboarding_state: ONBOARDING_STATES.CATEGORIES_SELECTED,
      })
      .eq('user_id', user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error?.message ?? '대분류 저장 실패' }, { status: 500 });
  }
}

