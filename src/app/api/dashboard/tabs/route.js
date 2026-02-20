export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { normalizeSubCategory } from '@/lib/dashboard/category-normalize';

export async function GET(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user's subcategories
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

    const tabs = Array.from(tabSet);

    return NextResponse.json({ tabs });
}

