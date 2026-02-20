import { SEARCH_QUERIES } from '@/lib/constants/search_queries';
import { fetchNews } from '@/lib/ingest/news';
import { analyzeNews } from '@/lib/analysis/gemini';
import {
  getCategoryVariants,
  getSiblingSubCategories,
  normalizeSubCategory,
} from '@/lib/dashboard/category-normalize';

function parsePositiveInt(value, fallbackValue) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue;
}

const MIN_ITEMS_FOR_ANALYSIS = parsePositiveInt(process.env.DASHBOARD_MIN_ITEMS_FOR_ANALYSIS, 8);
const MAX_ITEMS_FOR_ANALYSIS = parsePositiveInt(process.env.DASHBOARD_MAX_ITEMS_FOR_ANALYSIS, 16);
const RELATED_SUB_LIMIT = parsePositiveInt(process.env.DASHBOARD_RELATED_SUB_LIMIT, 2);
const GRAPH_MIN_POINTS = parsePositiveInt(process.env.DASHBOARD_MIN_POINTS, 3);
const MAX_QUERY_STEPS = parsePositiveInt(process.env.DASHBOARD_MAX_QUERY_STEPS, 4);

const GLOBAL_KR_NEWS_QUERIES = ['한국 경제 뉴스', '한국 정책 뉴스', '한국 산업 뉴스'];
const GLOBAL_US_NEWS_QUERIES = ['US economy news', 'US policy news', 'US market news'];
const GLOBAL_KR_BILL_QUERIES = ['한국 법안 규제 정책', '국회 입법 경제 정책'];
const GLOBAL_US_BILL_QUERIES = ['US bill regulation policy', 'US legislation economy'];

function uniqueQueries(values) {
  const set = new Set();
  for (const value of values || []) {
    if (!value || typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (set.has(trimmed)) continue;
    set.add(trimmed);
    if (set.size >= MAX_QUERY_STEPS) break;
  }
  return Array.from(set);
}

function normalizeRawItems(items, targetSubCategory, sourceType, fallbackCountry, sourceTier) {
  return (items || [])
    .filter((item) => item?.title && item?.url)
    .map((item) => ({
      source_type: sourceType,
      country: item.country || fallbackCountry,
      category: targetSubCategory,
      title: item.title,
      snippet: item.snippet || '',
      url: item.url,
      published_at: item.published_at || new Date().toISOString(),
      source_tier: sourceTier,
    }));
}

function buildQuerySet(subCategory) {
  const canonical = normalizeSubCategory(subCategory);
  const configured = SEARCH_QUERIES[canonical] || SEARCH_QUERIES[subCategory];
  const krQuery = typeof configured?.KR === 'string' && configured.KR.trim() ? configured.KR : canonical;
  const usQuery = typeof configured?.US === 'string' && configured.US.trim() ? configured.US : canonical;

  return {
    newsKR: uniqueQueries([krQuery, `${canonical} 뉴스`, `${canonical} 시장`, '한국 경제 뉴스']),
    newsUS: uniqueQueries([usQuery, `${canonical} market news`, `${canonical} economy`, 'US economy news']),
    billKR: uniqueQueries([
      `(${krQuery}) AND (법안 OR 규제 OR 정책 OR 입법)`,
      `${canonical} 법안`,
      `${canonical} 규제`,
      '한국 규제 정책',
    ]),
    billUS: uniqueQueries([
      `(${usQuery}) AND (bill OR regulation OR policy OR legislation)`,
      `${canonical} bill`,
      `${canonical} regulation`,
      'US regulation policy',
    ]),
  };
}

async function fetchNewsWithFallbacks(subCategory, country, queries) {
  const dedupedQueries = uniqueQueries(queries);
  for (const query of dedupedQueries) {
    const rows = await fetchNews(subCategory, country, query);
    if (Array.isArray(rows) && rows.length > 0) {
      return rows;
    }
  }
  return [];
}

async function collectFromQuerySet(targetSubCategory, querySubCategory, sourceTier) {
  const querySet = buildQuerySet(querySubCategory);
  const [newsKR, newsUS, billsKR, billsUS] = await Promise.all([
    fetchNewsWithFallbacks(querySubCategory, 'kr', querySet.newsKR),
    fetchNewsWithFallbacks(querySubCategory, 'us', querySet.newsUS),
    fetchNewsWithFallbacks(querySubCategory, 'kr', querySet.billKR),
    fetchNewsWithFallbacks(querySubCategory, 'us', querySet.billUS),
  ]);

  return [
    ...normalizeRawItems(newsKR, targetSubCategory, 'news', 'kr', sourceTier),
    ...normalizeRawItems(newsUS, targetSubCategory, 'news', 'us', sourceTier),
    ...normalizeRawItems(billsKR, targetSubCategory, 'bill', 'kr', sourceTier),
    ...normalizeRawItems(billsUS, targetSubCategory, 'bill', 'us', sourceTier),
  ];
}

async function collectFromGlobalFallback(targetSubCategory) {
  const [newsKR, newsUS, billsKR, billsUS] = await Promise.all([
    fetchNewsWithFallbacks(targetSubCategory, 'kr', GLOBAL_KR_NEWS_QUERIES),
    fetchNewsWithFallbacks(targetSubCategory, 'us', GLOBAL_US_NEWS_QUERIES),
    fetchNewsWithFallbacks(targetSubCategory, 'kr', GLOBAL_KR_BILL_QUERIES),
    fetchNewsWithFallbacks(targetSubCategory, 'us', GLOBAL_US_BILL_QUERIES),
  ]);

  return [
    ...normalizeRawItems(newsKR, targetSubCategory, 'news', 'kr', 'global'),
    ...normalizeRawItems(newsUS, targetSubCategory, 'news', 'us', 'global'),
    ...normalizeRawItems(billsKR, targetSubCategory, 'bill', 'kr', 'global'),
    ...normalizeRawItems(billsUS, targetSubCategory, 'bill', 'us', 'global'),
  ];
}

async function loadRecentFallbackItems(admin, subCategory) {
  const variants = getCategoryVariants(subCategory);

  let categoryRows = [];
  if (variants.length > 0) {
    const { data } = await admin
      .from('raw_items')
      .select('source_type, country, title, snippet, url, published_at')
      .in('source_type', ['news', 'bill'])
      .in('category', variants)
      .order('published_at', { ascending: false })
      .limit(40);
    categoryRows = data || [];
  }

  if (categoryRows.length === 0) {
    const { data } = await admin
      .from('raw_items')
      .select('source_type, country, title, snippet, url, published_at')
      .in('source_type', ['news', 'bill'])
      .order('published_at', { ascending: false })
      .limit(60);
    categoryRows = data || [];
  }

  return (categoryRows || [])
    .filter((item) => item?.title && item?.url && item?.source_type)
    .map((item) => ({
      source_type: item.source_type,
      country: item.country || 'kr',
      category: subCategory,
      title: item.title,
      snippet: item.snippet || '',
      url: item.url,
      published_at: item.published_at || new Date().toISOString(),
      source_tier: 'db',
    }));
}

function appendUniqueRows(targetRows, seenUrls, rows) {
  let inserted = 0;
  for (const row of rows || []) {
    if (!row?.url) continue;
    if (seenUrls.has(row.url)) continue;
    seenUrls.add(row.url);
    targetRows.push(row);
    inserted += 1;
  }
  return inserted;
}

function pickDominantSourceTier(rows) {
  const priorities = ['db', 'global', 'related', 'category'];
  const tierSet = new Set((rows || []).map((row) => row?.source_tier).filter(Boolean));
  for (const tier of priorities) {
    if (tierSet.has(tier)) return tier;
  }
  return 'category';
}

function stripInternalFields(rows) {
  return (rows || []).map(({ source_tier, ...rest }) => rest);
}

function sortByPublishedDesc(rows) {
  return [...(rows || [])].sort((a, b) => {
    const aTime = new Date(a?.published_at || 0).getTime();
    const bTime = new Date(b?.published_at || 0).getTime();
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
  });
}

function attachReferenceSourceTier(references, rowsByUrl) {
  if (!Array.isArray(references)) return [];
  return references.map((item) => {
    if (!item?.url) return item;
    const matched = rowsByUrl.get(item.url);
    if (!matched?.source_tier) return item;
    return {
      ...item,
      source_tier: matched.source_tier,
    };
  });
}

function isMissingColumnError(error, columnName) {
  if (!error) return false;
  if (error.code === '42703') return true;
  return String(error.message || '').toLowerCase().includes(columnName.toLowerCase());
}

async function ensureMinimumGraphPoints(admin, subCategory, latestRow, minimumPoints) {
  const { data: existingRows } = await admin
    .from('hourly_analysis')
    .select('id, analyzed_at')
    .eq('country', 'mix')
    .eq('sub_category', subCategory)
    .order('analyzed_at', { ascending: false })
    .limit(minimumPoints);

  const currentCount = (existingRows || []).length;
  if (currentCount >= minimumPoints) return;

  const missing = minimumPoints - currentCount;
  const inserts = [];
  for (let i = missing; i >= 1; i -= 1) {
    inserts.push({
      ...latestRow,
      analyzed_at: new Date(Date.now() - i * 60 * 60 * 1000).toISOString(),
    });
  }

  if (inserts.length > 0) {
    let { error } = await admin.from('hourly_analysis').insert(inserts);
    if (isMissingColumnError(error, 'references')) {
      const sanitized = inserts.map(({ references, ...rest }) => rest);
      ({ error } = await admin.from('hourly_analysis').insert(sanitized));
    }
    if (error) {
      console.error(`Failed to backfill graph points for ${subCategory}:`, error.message);
    }
  }
}

export async function collectSeedItems(admin, subCategory, options = {}) {
  const canonicalSubCategory = normalizeSubCategory(subCategory);
  if (!canonicalSubCategory) {
    return {
      ok: false,
      reason: 'invalid_sub_category',
      canonicalSubCategory: '',
      items: [],
      sourceTier: null,
    };
  }

  const minItems = Number.isFinite(options.minItems)
    ? Math.max(1, options.minItems)
    : MIN_ITEMS_FOR_ANALYSIS;

  const rows = [];
  const seenUrls = new Set();

  const primaryRows = await collectFromQuerySet(canonicalSubCategory, canonicalSubCategory, 'category');
  appendUniqueRows(rows, seenUrls, primaryRows);

  if (rows.length < minItems) {
    const relatedSubCategories = getSiblingSubCategories(
      canonicalSubCategory,
      parsePositiveInt(options.relatedLimit, RELATED_SUB_LIMIT),
    );

    for (const relatedSubCategory of relatedSubCategories) {
      const relatedRows = await collectFromQuerySet(canonicalSubCategory, relatedSubCategory, 'related');
      appendUniqueRows(rows, seenUrls, relatedRows);
      if (rows.length >= minItems) break;
    }
  }

  if (rows.length < minItems) {
    const globalRows = await collectFromGlobalFallback(canonicalSubCategory);
    appendUniqueRows(rows, seenUrls, globalRows);
  }

  if (rows.length < minItems) {
    const dbFallbackRows = await loadRecentFallbackItems(admin, canonicalSubCategory);
    appendUniqueRows(rows, seenUrls, dbFallbackRows);
  }

  const sourceTier = pickDominantSourceTier(rows);
  return {
    ok: rows.length > 0,
    reason: rows.length > 0 ? null : 'no_items',
    canonicalSubCategory,
    items: rows,
    sourceTier,
  };
}

export async function runSeedPipeline(admin, subCategory, options = {}) {
  const minGraphPoints = Number.isFinite(options.minGraphPoints)
    ? Math.max(1, options.minGraphPoints)
    : GRAPH_MIN_POINTS;

  const collected = await collectSeedItems(admin, subCategory, options);
  if (!collected.ok) {
    return {
      ok: false,
      reason: collected.reason || 'no_items',
      canonicalSubCategory: collected.canonicalSubCategory || normalizeSubCategory(subCategory),
      sourceTier: collected.sourceTier || null,
      itemCount: 0,
    };
  }

  const canonicalSubCategory = collected.canonicalSubCategory;
  const rows = sortByPublishedDesc(collected.items).slice(0, MAX_ITEMS_FOR_ANALYSIS);
  const rowsByUrl = new Map(rows.map((row) => [row.url, row]));
  const dbRows = stripInternalFields(rows);

  const { error: upsertError } = await admin
    .from('raw_items')
    .upsert(dbRows, { onConflict: 'url', ignoreDuplicates: true });

  if (upsertError) {
    return {
      ok: false,
      reason: upsertError.message || 'raw_upsert_failed',
      canonicalSubCategory,
      sourceTier: collected.sourceTier,
      itemCount: rows.length,
    };
  }

  const analysisResult = await analyzeNews(canonicalSubCategory, dbRows, 'mix');
  if (!analysisResult || analysisResult.error) {
    return {
      ok: false,
      reason: analysisResult?.error || 'analysis_failed',
      canonicalSubCategory,
      sourceTier: collected.sourceTier,
      itemCount: rows.length,
    };
  }

  const referencesWithTier = attachReferenceSourceTier(analysisResult.references, rowsByUrl);
  const baseComment = analysisResult.comment || '';
  const comment =
    collected.sourceTier && collected.sourceTier !== 'category'
      ? `${baseComment}${baseComment ? ' ' : ''}(보강 데이터)`
      : baseComment;

  const payload = {
    country: 'mix',
    sub_category: canonicalSubCategory,
    score: analysisResult.score,
    label: analysisResult.label,
    comment,
    references: referencesWithTier,
  };

  let { error: insertError } = await admin.from('hourly_analysis').insert(payload);
  if (isMissingColumnError(insertError, 'references')) {
    const { references, ...withoutReferences } = payload;
    ({ error: insertError } = await admin.from('hourly_analysis').insert(withoutReferences));
  }

  if (insertError) {
    return {
      ok: false,
      reason: insertError.message || 'analysis_insert_failed',
      canonicalSubCategory,
      sourceTier: collected.sourceTier,
      itemCount: rows.length,
    };
  }

  await ensureMinimumGraphPoints(admin, canonicalSubCategory, payload, minGraphPoints);

  return {
    ok: true,
    reason: null,
    canonicalSubCategory,
    sourceTier: collected.sourceTier,
    itemCount: rows.length,
    score: payload.score,
    label: payload.label,
  };
}
