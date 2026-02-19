export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { analyzeTopic } from '@/lib/analyze/openai';

// const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request) {
    // Check Auth...

    const supabase = await createClient();

    // 1. Get categories that need analysis
    // Strategy: Analyze categories that have new raw_items in the last hour
    // Or just analyze all subscribed categories.

    // Let's get list of categories from raw_items (last 24h)
    const { data: recentItems } = await supabase
        .from('raw_items')
        .select('category, country, title, published_at')
        .order('published_at', { ascending: false })
        .limit(100); // Fetch recent 100 items global

    // Group by category/country
    const grouped = {};
    recentItems?.forEach(item => {
        const key = `${item.country}:${item.category}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(item);
    });

    const results = [];

    for (const key of Object.keys(grouped)) {
        const [country, category] = key.split(':');
        const items = grouped[key].slice(0, 10); // Analyze top 10

        const analysis = await analyzeTopic(items, category, country);

        if (analysis.score !== null) {
            // Save to hourly_analysis
            const { error } = await supabase
                .from('hourly_analysis')
                .insert({
                    country,
                    big_category: 'Unknown', // Need to map back if needed, or allow null
                    sub_category: category,
                    score: analysis.score,
                    label: analysis.label,
                    comment: analysis.comment,
                    confidence: analysis.confidence
                });

            if (!error) {
                results.push({ key, score: analysis.score });
            }
        }
    }

    return NextResponse.json({
        success: true,
        analyzed: results
    });
}

