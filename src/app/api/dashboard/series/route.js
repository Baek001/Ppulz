import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, hasSupabaseAdminEnv } from '@/lib/supabase/admin';
import { SEARCH_QUERIES } from '@/lib/constants/search_queries';
import { fetchNews } from '@/lib/ingest/news';
import { analyzeNews } from '@/lib/analysis/gemini';

const ANALYSIS_COUNTRIES = ['mix', 'kr', 'us'];
const ANALYSIS_LIMIT = 5;
const MAX_SERIES_POINTS = 5;
const SEED_COOLDOWN_MS = 10 * 60 * 1000;
const seedInFlight = new Map();
const recentSeedAttemptAt = new Map();

function parsePositiveInt(value, fallbackValue) {
    const parsed = Number.parseInt(value ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue;
}

const MIN_SERIES_POINTS = Math.min(
    MAX_SERIES_POINTS,
    Math.max(2, parsePositiveInt(process.env.DASHBOARD_MIN_POINTS, 3)),
);

function isMissingColumnError(error, columnName) {
    if (!error) return false;
    if (error.code === '42703') return true;
    return String(error.message || '').toLowerCase().includes(columnName.toLowerCase());
}

function mergeReferences(primary, fallback) {
    const refs = Array.isArray(primary) ? primary : [];
    const fallbackRefs = Array.isArray(fallback) ? fallback : [];
    const usedKeys = new Set();

    const makeKey = (item) => `${item?.source_type || ''}::${item?.url || ''}::${item?.title || ''}`;
    const pushUnique = (target, item) => {
        if (!item?.title || !item?.url || !item?.source_type) return;
        const key = makeKey(item);
        if (usedKeys.has(key)) return;
        usedKeys.add(key);
        target.push(item);
    };

    const news = [];
    const bills = [];

    for (const item of refs) {
        if (item?.source_type === 'news') pushUnique(news, item);
        if (item?.source_type === 'bill') pushUnique(bills, item);
    }

    for (const item of fallbackRefs) {
        if (item?.source_type === 'news' && news.length < 4) pushUnique(news, item);
        if (item?.source_type === 'bill' && bills.length < 2) pushUnique(bills, item);
    }

    return [...news.slice(0, 4), ...bills.slice(0, 2)];
}

async function fetchFallbackReferences(supabase, subCategory) {
    const { data, error } = await supabase
        .from('raw_items')
        .select('title, url, source_type, published_at')
        .in('source_type', ['news', 'bill'])
        .ilike('category', `%${subCategory}%`)
        .order('published_at', { ascending: false })
        .limit(40);

    if (error) {
        return [];
    }

    const cleaned = (data || []).filter((item) => item?.title && item?.url);
    const seen = new Set();

    const normalize = (item) => ({
        title: item.title,
        url: item.url,
        source_type: item.source_type
    });
    const keyOf = (item) => `${item.source_type}::${item.url}`;
    const pushUnique = (target, item) => {
        const key = keyOf(item);
        if (seen.has(key)) return;
        seen.add(key);
        target.push(item);
    };

    const newsRefs = [];
    const billRefs = [];

    for (const item of cleaned) {
        const normalized = normalize(item);
        if (normalized.source_type === 'news' && newsRefs.length < 4) {
            pushUnique(newsRefs, normalized);
        }
        if (normalized.source_type === 'bill' && billRefs.length < 2) {
            pushUnique(billRefs, normalized);
        }
        if (newsRefs.length >= 4 && billRefs.length >= 2) break;
    }

    // If category-matched rows are sparse, backfill with recent rows.
    if (newsRefs.length < 4 || billRefs.length < 2) {
        const { data: recentRows, error: recentError } = await supabase
            .from('raw_items')
            .select('title, url, source_type, published_at')
            .in('source_type', ['news', 'bill'])
            .order('published_at', { ascending: false })
            .limit(120);

        if (!recentError) {
            for (const item of recentRows || []) {
                if (!item?.title || !item?.url) continue;
                const normalized = normalize(item);
                if (normalized.source_type === 'news' && newsRefs.length < 4) {
                    pushUnique(newsRefs, normalized);
                }
                if (normalized.source_type === 'bill' && billRefs.length < 2) {
                    pushUnique(billRefs, normalized);
                }
                if (newsRefs.length >= 4 && billRefs.length >= 2) break;
            }
        }
    }

    return [...newsRefs, ...billRefs];
}

function getQueriesForSubCategory(subCategory) {
    const configured = SEARCH_QUERIES[subCategory];

    const krQuery =
        typeof configured?.KR === 'string' && configured.KR.trim().length > 0
            ? configured.KR
            : subCategory;

    const usQuery =
        typeof configured?.US === 'string' && configured.US.trim().length > 0
            ? configured.US
            : subCategory;

    return { krQuery, usQuery };
}

function normalizeRawItems(items, subCategory, sourceType, fallbackCountry) {
    return (items || [])
        .filter((item) => item?.title && item?.url)
        .map((item) => ({
            source_type: sourceType,
            country: item.country || fallbackCountry,
            category: subCategory,
            title: item.title,
            snippet: item.snippet || '',
            url: item.url,
            published_at: item.published_at || new Date().toISOString(),
        }));
}

async function buildMixedItems(subCategory) {
    const { krQuery, usQuery } = getQueriesForSubCategory(subCategory);

    const [newsKR, newsUS, billsKR, billsUS] = await Promise.all([
        fetchNews(subCategory, 'kr', krQuery),
        fetchNews(subCategory, 'us', usQuery),
        fetchNews(
            subCategory,
            'kr',
            `(${krQuery}) AND (\uBC95\uC548 OR \uADDC\uC81C OR \uC815\uCC45 OR \uC785\uBC95 OR law OR bill OR regulation)`,
        ),
        fetchNews(
            subCategory,
            'us',
            `(${usQuery}) AND (bill OR regulation OR policy OR legislation)`,
        ),
    ]);

    const combined = [
        ...normalizeRawItems(newsKR, subCategory, 'news', 'kr'),
        ...normalizeRawItems(newsUS, subCategory, 'news', 'us'),
        ...normalizeRawItems(billsKR, subCategory, 'bill', 'kr'),
        ...normalizeRawItems(billsUS, subCategory, 'bill', 'us'),
    ];

    const deduped = [];
    const seen = new Set();

    for (const item of combined) {
        const key = item.url;
        if (!key || seen.has(key)) {
            continue;
        }
        seen.add(key);
        deduped.push(item);
    }

    return deduped;
}

function normalizeScore(value) {
    const numericScore = Number(value);
    if (!Number.isFinite(numericScore)) {
        return 50;
    }
    return Math.max(0, Math.min(100, Math.round(numericScore)));
}

function getMinimumSeriesPoints() {
    return MIN_SERIES_POINTS;
}

function cleanupOldSeedAttempts(nowMs) {
    for (const [category, attemptedAt] of recentSeedAttemptAt.entries()) {
        if (nowMs - attemptedAt > SEED_COOLDOWN_MS) {
            recentSeedAttemptAt.delete(category);
        }
    }
}

function buildAnalysisWindows(items, count) {
    const windows = [];

    if (!Array.isArray(items) || items.length === 0 || count <= 0) {
        return windows;
    }

    let previousSize = 0;

    for (let index = 0; index < count; index += 1) {
        const ratio = (index + 1) / count;
        let size = Math.round(items.length * ratio);

        if (size <= previousSize && previousSize < items.length) {
            size = previousSize + 1;
        }

        size = Math.max(1, Math.min(items.length, size));
        previousSize = size;
        windows.push(items.slice(0, size));
    }

    while (windows.length < count) {
        windows.push(items);
    }

    return windows;
}

function getBackfilledTimestamps(currentRows, count) {
    const nowMs = Date.now();

    if (!Array.isArray(currentRows) || currentRows.length === 0) {
        return Array.from({ length: count }, (_, index) => {
            const offsetHours = count - 1 - index;
            return new Date(nowMs - offsetHours * 60 * 60 * 1000).toISOString();
        });
    }

    const timestamps = currentRows
        .map((item) => new Date(item?.analyzed_at).getTime())
        .filter((value) => Number.isFinite(value));

    const earliestMs = timestamps.length > 0 ? Math.min(...timestamps) : nowMs;

    return Array.from({ length: count }, (_, index) => {
        const offsetHours = count - index;
        return new Date(earliestMs - offsetHours * 60 * 60 * 1000).toISOString();
    });
}

async function ensureMinimumSeriesPoints(subCategory, currentRows) {
    if (!hasSupabaseAdminEnv() || !process.env.GOOGLE_GEMINI_KEY) {
        return false;
    }

    const minimumPoints = getMinimumSeriesPoints();

    if ((currentRows || []).length >= minimumPoints) {
        return false;
    }

    const existingTask = seedInFlight.get(subCategory);
    if (existingTask) {
        return existingTask;
    }

    const seedTask = (async () => {
        const nowMs = Date.now();
        cleanupOldSeedAttempts(nowMs);

        const lastAttemptedAt = recentSeedAttemptAt.get(subCategory);
        if (lastAttemptedAt && nowMs - lastAttemptedAt < SEED_COOLDOWN_MS) {
            return false;
        }

        recentSeedAttemptAt.set(subCategory, nowMs);

        const missingCount = Math.max(0, minimumPoints - (currentRows?.length ?? 0));
        if (missingCount === 0) {
            return false;
        }

        const admin = createAdminClient();
        const mixedItems = await buildMixedItems(subCategory);

        if (mixedItems.length === 0) {
            return false;
        }

        await admin
            .from('raw_items')
            .upsert(mixedItems, { onConflict: 'url', ignoreDuplicates: true });

        const windows = buildAnalysisWindows(mixedItems, missingCount);
        const timestamps = getBackfilledTimestamps(currentRows, missingCount);
        const rowsToInsert = [];

        for (let index = 0; index < missingCount; index += 1) {
            const itemsForWindow = windows[index] || mixedItems;
            const analysisResult = await analyzeNews(subCategory, itemsForWindow, 'mix');

            if (!analysisResult || analysisResult.error) {
                continue;
            }

            rowsToInsert.push({
                country: 'mix',
                sub_category: subCategory,
                score: normalizeScore(analysisResult.score),
                label: analysisResult.label || '\uD63C\uD569',
                comment: analysisResult.comment || '',
                references: Array.isArray(analysisResult.references) ? analysisResult.references : [],
                analyzed_at: timestamps[index],
            });
        }

        if (rowsToInsert.length === 0) {
            return false;
        }

        let { error: insertError } = await admin
            .from('hourly_analysis')
            .insert(rowsToInsert);

        if (isMissingColumnError(insertError, 'references')) {
            const withoutReferences = rowsToInsert.map(({ references, ...rest }) => rest);
            ({ error: insertError } = await admin
                .from('hourly_analysis')
                .insert(withoutReferences));
        }

        return !insertError;
    })();

    seedInFlight.set(subCategory, seedTask);

    try {
        return await seedTask;
    } finally {
        seedInFlight.delete(subCategory);
    }
}

async function loadSeriesRows(supabase, subCategory) {
    // Try fetching references first, then gracefully fallback for older schemas.
    const runQuery = (columns) => (
        supabase
            .from('hourly_analysis')
            .select(columns)
            .in('country', ANALYSIS_COUNTRIES)
            .eq('sub_category', subCategory)
            .order('analyzed_at', { ascending: false })
            .limit(ANALYSIS_LIMIT)
    );

    let includeReferences = true;
    let { data: analysis, error } = await runQuery('score, label, comment, references, analyzed_at');

    if (isMissingColumnError(error, 'references')) {
        includeReferences = false;
        ({ data: analysis, error } = await runQuery('score, label, comment, analyzed_at'));
    }

    return { analysis, error, includeReferences };
}

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const subCategory = searchParams.get('sub');

    if (!subCategory) {
        return NextResponse.json({ error: 'Missing sub parameter' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // FEATURE FLAG: Mock Data Mode
    if (process.env.USE_MOCK_ANALYSIS === 'true') {
        const { generateMockSeries } = require('@/lib/mock/generator');
        const mockSeries = generateMockSeries(
            user.id,
            subCategory
        );
        return NextResponse.json({ series: mockSeries });
    }

    let { analysis, error, includeReferences } = await loadSeriesRows(supabase, subCategory);

    if (!error && (analysis || []).length < getMinimumSeriesPoints()) {
        await ensureMinimumSeriesPoints(subCategory, analysis || []);
        ({ analysis, error, includeReferences } = await loadSeriesRows(supabase, subCategory));
    }

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Reverse to show chronological order in graph.
    const sorted = (analysis || []).reverse();

    const series = sorted.map((item) => ({
        timestamp: item.analyzed_at,
        score: item.score,
        label: item.label,
        comment: item.comment || '',
        references: includeReferences && Array.isArray(item.references) ? item.references : []
    }));

    if (series.length > 0) {
        const fallbackReferences = await fetchFallbackReferences(supabase, subCategory);
        const latestReferences = series[series.length - 1].references;

        if (!includeReferences) {
            series[series.length - 1].references = mergeReferences([], fallbackReferences);
        } else {
            series[series.length - 1].references = mergeReferences(latestReferences, fallbackReferences);
        }
    }

    return NextResponse.json({
        series
    });
}
