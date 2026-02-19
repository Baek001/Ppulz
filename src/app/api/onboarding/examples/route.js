export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getOrCreateOnboardingRow } from '@/lib/onboarding/guards';
import { ONBOARDING_STATES } from '@/lib/onboarding/state';
import { createClient } from '@/lib/supabase/server';

const requestSchema = z.object({
  checkedCardIds: z.array(z.string().min(1)).max(6),
});

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 });
    }

    const uniqueCardIds = [...new Set(parsed.data.checkedCardIds)];

    if (uniqueCardIds.length !== parsed.data.checkedCardIds.length) {
      return NextResponse.json({ error: '중복 카드 선택은 허용되지 않습니다.' }, { status: 400 });
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
      return NextResponse.json({ error: '대분류 선택이 먼저 필요합니다.' }, { status: 400 });
    }

    if (onboarding.sub_categories.length !== 5) {
      return NextResponse.json({ error: '소분류 5개 선택이 먼저 필요합니다.' }, { status: 400 });
    }

    if (uniqueCardIds.length > 0) {
      const { data: cards, error: cardsError } = await supabase
        .from('example_cards')
        .select('card_id, big_category')
        .in('card_id', uniqueCardIds);

      if (cardsError) {
        return NextResponse.json({ error: cardsError.message }, { status: 500 });
      }

      if (!cards || cards.length !== uniqueCardIds.length) {
        return NextResponse.json({ error: '유효하지 않은 카드가 포함되어 있습니다.' }, { status: 400 });
      }

      const invalidCard = cards.some((card) => !onboarding.big_categories.includes(card.big_category));
      if (invalidCard) {
        return NextResponse.json({ error: '선택 범위를 벗어난 카드가 포함되어 있습니다.' }, { status: 400 });
      }
    }

    const { error: examplesDoneError } = await supabase
      .from('user_onboarding')
      .update({
        example_checked: uniqueCardIds,
        onboarding_state: ONBOARDING_STATES.EXAMPLES_DONE,
      })
      .eq('user_id', user.id);

    if (examplesDoneError) {
      return NextResponse.json({ error: examplesDoneError.message }, { status: 500 });
    }

    const { error: completeError } = await supabase
      .from('user_onboarding')
      .update({ onboarding_state: ONBOARDING_STATES.COMPLETED })
      .eq('user_id', user.id);

    if (completeError) {
      return NextResponse.json({ error: completeError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, next: '/dashboard' });
  } catch (error) {
    return NextResponse.json({ error: error?.message ?? '온보딩 완료 처리 실패' }, { status: 500 });
  }
}

