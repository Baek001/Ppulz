export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SEARCH_QUERIES } from '@/lib/constants/search_queries';
import { fetchNews } from '@/lib/ingest/news';

const logs = [];
export const dynamic = 'force-dynamic';
const DEFAULT_FALLBACK_SUBS = ['利앷텒/二쇱떇', '?뚰겕/IT', '遺?숈궛'];

function log(message) {
    const timestamp = new Date().toISOString();
    logs.push(`${timestamp}: ${message}`);
    console.log(message);
}

function isCronAuthorized(request) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return false;
    const headerSecret = request.headers.get('x-cron-secret');
    if (headerSecret && headerSecret === cronSecret) {
        return true;
    }
    const { searchParams } = new URL(request.url);
    return searchParams.get('token') === cronSecret;
}

function isMissingTableError(error, tableName) {
    if (!error) return false;
    if (error.code === '42P01') return true;
    const message = String(error.message || '').toLowerCase();
    return tableName ? message.includes(tableName.toLowerCase()) && message.includes('does not exist') : false;
}

function parsePositiveInt(value, fallbackValue) {
    const parsed = Number.parseInt(value ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue;
}

function normalizeSubCategory(item) {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object' && typeof item.sub_category === 'string') {
        return item.sub_category;
    }
    return null;
}

async function loadSeedRequests(supabase, limit) {
    const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : null;
    try {
        let query = supabase
            .from('seed_requests')
            .select('sub_category, attempts, status, requested_at')
            .in('status', ['pending', 'failed'])
            .order('requested_at', { ascending: true });

        if (safeLimit) {
            query = query.limit(safeLimit);
        }

        const { data, error } = await query;
        if (error) {
            if (isMissingTableError(error, 'seed_requests')) {
                log('seed_requests table missing. Skipping queue mode.');
            } else {
                log(`Failed to load seed_requests: ${error.message}`);
            }
            return [];
        }

        return data || [];
    } catch (error) {
        log(`Failed to load seed_requests: ${error.message}`);
        return [];
    }
}

async function updateSeedStatus(supabase, subCategory, status, { attempts, lastError } = {}) {
    try {
        const payload = {
            status,
            last_error: lastError ?? null,
        };

        if (Number.isFinite(attempts)) {
            payload.attempts = attempts;
        }

        await supabase
            .from('seed_requests')
            .update(payload)
            .eq('sub_category', subCategory);
    } catch (error) {
        log(`Failed to update seed_requests for ${subCategory}: ${error.message}`);
    }
}

export async function GET(request) {
    log('GET /api/cron/ingest started');

    if (!isCronAuthorized(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use Service Role Key to bypass RLS and fetch all user categories
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Missing Supabase Service Key' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results = [];

    // 1. Load seed requests first (queue mode)
    const maxTargets = parsePositiveInt(
        process.env.INGEST_MAX_SUBS_PER_RUN ?? process.env.INGEST_TARGET_LIMIT,
        0,
    );
    const seedRequests = await loadSeedRequests(supabase, maxTargets);
    const seedMap = new Map(seedRequests.map((item) => [item.sub_category, item]));

    let targetSubs = seedRequests.map((item) => item.sub_category).filter(Boolean);
    let queueMode = targetSubs.length > 0;

    // 2. Fallback: derive categories from onboarding
    if (!queueMode) {
        const { data: categories, error } = await supabase
            .from('user_onboarding')
            .select('sub_categories')
            .not('sub_categories', 'is', null);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Flatten and unique
        let allSubs = [...new Set(
            categories
                .flatMap((c) => c.sub_categories || [])
                .map((item) => normalizeSubCategory(item))
                .filter(Boolean)
        )];

        // Fallback for Cold Start
        if (allSubs.length === 0) {
            log('No user categories found. Using default fallback categories.');
            allSubs = DEFAULT_FALLBACK_SUBS;
        }

        targetSubs =
            Number.isFinite(maxTargets) && maxTargets > 0
                ? allSubs.slice(0, maxTargets)
                : allSubs;
    }

    // 3. Ingest & Analyze
    // By default, analyze all selected subcategories so category edits immediately reflect in dashboard data.
    const { analyzeNews } = require('@/lib/analysis/gemini');

    for (const sub of targetSubs) {
        if (queueMode) {
            const current = seedMap.get(sub);
            const attempts = Number(current?.attempts || 0) + 1;
            await updateSeedStatus(supabase, sub, 'processing', { attempts });
        }

        // A. Fetch Mixed Data (KR News, US News, KR Bill, US Bill)
        const queries = SEARCH_QUERIES[sub] || { KR: sub, US: sub }; // Fallback to basic string if obj missing

        // Define requests
        const requests = [
            fetchNews(sub, 'kr', queries.KR), // KR News
            fetchNews(sub, 'us', queries.US), // US News
            fetchNews(sub + ' 踰뺤븞', 'kr', queries.KR ? `(${queries.KR}) AND (踰뺤븞 OR 洹쒖젣 OR ?뺤콉)` : `${sub} 踰뺤븞 洹쒖젣`), // KR Bill Proxy
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
                            if (queueMode) {
                                await updateSeedStatus(supabase, sub, 'done', { lastError: null });
                            }
                            analyzeError = null; // Clear error
                        } else {
                            log(`Retry failed: ${retryError.message}`);
                            if (queueMode) {
                                await updateSeedStatus(supabase, sub, 'failed', { lastError: retryError.message });
                            }
                        }
                    } else {
                        log(`Analysis insert failed: ${analyzeError.message}`);
                        if (queueMode) {
                            await updateSeedStatus(supabase, sub, 'failed', { lastError: analyzeError.message });
                        }
                    }
                } else {
                    results.push({ category: sub, count: allItems.length, analyzed: true, score: analysisResult.score });
                    if (queueMode) {
                        await updateSeedStatus(supabase, sub, 'done', { lastError: null });
                    }
                }
            } else {
                log(`Analysis failed for ${sub}: ${analysisResult?.error || 'Unknown error'}`);
                if (queueMode) {
                    await updateSeedStatus(supabase, sub, 'failed', { lastError: analysisResult?.error || 'Unknown error' });
                }
            }
        } else {
            log(`No items found for ${sub}`);
            if (queueMode) {
                await updateSeedStatus(supabase, sub, 'done', { lastError: 'no_items' });
            }
        }
    }

    return NextResponse.json({
        success: true,
        ingested: results,
        logs: logs,
        queueMode,
    });
}

