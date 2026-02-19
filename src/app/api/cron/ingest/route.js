import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SEARCH_QUERIES } from '@/lib/constants/search_queries';
import { fetchNews } from '@/lib/ingest/news';

const logs = [];
export const dynamic = 'force-dynamic';

function log(message) {
    const timestamp = new Date().toISOString();
    logs.push(`${timestamp}: ${message}`);
    console.log(message);
}

export async function GET(request) {
    log('GET /api/cron/ingest started');

    // Use Service Role Key to bypass RLS and fetch all user categories
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Missing Supabase Service Key' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get all unique subcategories to track
    const { data: categories, error } = await supabase
        .from('user_onboarding')
        .select('sub_categories')
        .not('sub_categories', 'is', null);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Flatten and unique
    let allSubs = [...new Set(
        categories.flatMap(c => c.sub_categories || [])
            .map(item => (typeof item === 'object' && item.sub_category) ? item.sub_category : item)
    )];

    // Fallback for Cold Start
    if (allSubs.length === 0) {
        console.log('No user categories found. Using default fallback categories.');
        allSubs = ['증권/주식', '테크/IT', '부동산'];
    }

    const results = [];

    // 2. Ingest & Analyze
    // By default, analyze all selected subcategories so category edits immediately reflect in dashboard data.
    const maxTargets = Number(process.env.INGEST_TARGET_LIMIT || 0);
    const targetSubs =
        Number.isFinite(maxTargets) && maxTargets > 0
            ? allSubs.slice(0, maxTargets)
            : allSubs;
    const { analyzeNews } = require('@/lib/analysis/gemini');

    for (const sub of targetSubs) {
        // A. Fetch Mixed Data (KR News, US News, KR Bill, US Bill)
        const queries = SEARCH_QUERIES[sub] || { KR: sub, US: sub }; // Fallback to basic string if obj missing

        // Define requests
        const requests = [
            fetchNews(sub, 'kr', queries.KR), // KR News
            fetchNews(sub, 'us', queries.US), // US News
            fetchNews(sub + ' 법안', 'kr', queries.KR ? `(${queries.KR}) AND (법안 OR 규제 OR 정책)` : `${sub} 법안 규제`), // KR Bill Proxy
            fetchNews(sub + ' Bill', 'us', queries.US ? `(${queries.US}) AND (bill OR regulation OR legislation)` : `${sub} bill regulation`) // US Bill Proxy
        ];

        const [newsKR, newsUS, billsKR, billsUS] = await Promise.all(requests);

        // Label items with source_type
        const labelItems = (items, type) => items.map(i => ({ ...i, source_type: type }));

        const allItems = [
            ...labelItems(newsKR, 'news'),
            ...labelItems(newsUS, 'news'),
            ...labelItems(billsKR, 'bill'),
            ...labelItems(billsUS, 'bill')
        ];

        if (allItems.length > 0) {
            // Try to insert raw items (all types)
            // Note: raw_items table needs duplicate handling
            const { error: insertError } = await supabase
                .from('raw_items')
                .insert(allItems) // schema updated to accept these fields? verify raw_items schema
                .select();

            if (insertError) {
                // duplicate key error is expected.
            }

            // B. Analyze
            log(`Analyzing ${sub}: ${allItems.length} items (Mixed KR/US/Bills)...`);
            const analysisResult = await analyzeNews(sub, allItems, 'mix');

            if (analysisResult && !analysisResult.error) {
                log(`Analysis result for ${sub}: ${analysisResult.score}`);

                // Prepare insert payload
                const payload = {
                    country: 'mix', // Mixed analysis
                    sub_category: sub,
                    score: analysisResult.score,
                    label: analysisResult.label,
                    comment: analysisResult.comment,
                    references: analysisResult.references
                };

                let { error: analyzeError } = await supabase
                    .from('hourly_analysis')
                    .insert(payload);

                if (analyzeError) {
                    console.error(`Analysis insert failed for ${sub}`, analyzeError);

                    // Fallback: If 'references' column missing, retry without it
                    if (analyzeError.message.includes('references') || analyzeError.code === '42703') { // 42703 is undefined_column
                        log(`WARNING: 'references' column missing. Retrying without references...`);
                        delete payload.references;
                        const { error: retryError } = await supabase
                            .from('hourly_analysis')
                            .insert(payload);

                        if (!retryError) {
                            log(`Success: Inserted analysis without references.`);
                            results.push({ category: sub, count: allItems.length, analyzed: true, score: analysisResult.score, warning: 'Schema outdated' });
                            analyzeError = null; // Clear error
                        } else {
                            log(`Retry failed: ${retryError.message}`);
                        }
                    } else {
                        log(`Analysis insert failed: ${analyzeError.message}`);
                    }
                } else {
                    results.push({ category: sub, count: allItems.length, analyzed: true, score: analysisResult.score });
                }
            } else {
                log(`Analysis failed for ${sub}: ${analysisResult?.error || 'Unknown error'}`);
            }
        } else {
            log(`No items found for ${sub}`);
        }
    }

    return NextResponse.json({
        success: true,
        ingested: results,
        logs: logs
    });
}
