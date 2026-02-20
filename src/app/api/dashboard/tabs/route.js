export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { normalizeSubCategory } from '@/lib/dashboard/category-normalize';
import { createRequestClient } from '@/lib/supabase/request';

export async function GET(request) {
  const { supabase, user } = await createRequestClient(request);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: onboarding, error } = await supabase
    .from('user_onboarding')
    .select('sub_categories')
    .eq('user_id', user.id)
    .single();

  if (error || !onboarding) {
    return NextResponse.json({ error: 'Onboarding data not found' }, { status: 404 });
  }

  const tabSet = new Set();
  for (const item of onboarding.sub_categories || []) {
    const value = typeof item === 'object' && item?.sub_category ? item.sub_category : item;
    const normalized = normalizeSubCategory(value);
    if (normalized) {
      tabSet.add(normalized);
    }
  }

  return NextResponse.json({ tabs: Array.from(tabSet) });
}

