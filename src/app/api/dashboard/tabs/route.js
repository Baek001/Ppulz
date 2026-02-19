import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    // Ensure tabs are strings
    const tabs = (onboarding.sub_categories || []).map(item => {
        if (typeof item === 'object' && item.sub_category) {
            return item.sub_category;
        }
        return item;
    });

    return NextResponse.json({ tabs });
}
