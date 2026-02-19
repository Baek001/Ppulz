import { CATEGORY_TREE } from '@/lib/constants/categories';

export const MARKET_ANALYSIS_COUNTRIES = ['mix', 'kr', 'us'];
export const DEFAULT_LOOKBACK_HOURS = 24;
export const DEFAULT_PER_BIG_CATEGORY_LIMIT = 3;

export function buildSubToBigMap() {
  const map = new Map();

  Object.entries(CATEGORY_TREE).forEach(([bigCategory, subCategories]) => {
    subCategories.forEach((subCategory) => {
      map.set(subCategory, bigCategory);
    });
  });

  return map;
}

function toIsoOrEmpty(value) {
  const date = value ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) return '';
  return date.toISOString();
}

export function selectTopSubCategoriesByBigCategory(
  rows,
  { perBigCategoryLimit = DEFAULT_PER_BIG_CATEGORY_LIMIT } = {},
) {
  const statsBySub = new Map();
  const subToBig = buildSubToBigMap();

  (rows || []).forEach((row) => {
    const subCategory = row?.sub_category;
    const bigCategory = subToBig.get(subCategory);
    if (!subCategory || !bigCategory) return;

    const current = statsBySub.get(subCategory) || {
      bigCategory,
      count: 0,
      latestAnalyzedAt: '',
    };

    current.count += 1;

    const analyzedAtIso = toIsoOrEmpty(row?.analyzed_at);
    if (analyzedAtIso && (!current.latestAnalyzedAt || analyzedAtIso > current.latestAnalyzedAt)) {
      current.latestAnalyzedAt = analyzedAtIso;
    }

    statsBySub.set(subCategory, current);
  });

  const selectionByBig = new Map();

  Object.entries(CATEGORY_TREE).forEach(([bigCategory, subCategories]) => {
    const ranked = subCategories
      .map((subCategory, originalIndex) => {
        const stats = statsBySub.get(subCategory);
        return {
          subCategory,
          count: stats?.count || 0,
          latestAnalyzedAt: stats?.latestAnalyzedAt || '',
          originalIndex,
        };
      })
      .filter((item) => item.count > 0)
      .sort((left, right) => {
        if (right.count !== left.count) return right.count - left.count;
        if (right.latestAnalyzedAt !== left.latestAnalyzedAt) {
          return right.latestAnalyzedAt.localeCompare(left.latestAnalyzedAt);
        }
        return left.originalIndex - right.originalIndex;
      });

    const selected = ranked.slice(0, perBigCategoryLimit).map((item) => item.subCategory);

    if (selected.length < perBigCategoryLimit) {
      const used = new Set(selected);
      for (const subCategory of subCategories) {
        if (used.has(subCategory)) continue;
        selected.push(subCategory);
        used.add(subCategory);
        if (selected.length >= perBigCategoryLimit) break;
      }
    }

    selectionByBig.set(bigCategory, selected);
  });

  return selectionByBig;
}

export async function fetchTopSubCategoriesForBoard(
  admin,
  {
    lookbackHours = DEFAULT_LOOKBACK_HOURS,
    perBigCategoryLimit = DEFAULT_PER_BIG_CATEGORY_LIMIT,
  } = {},
) {
  const now = Date.now();
  const sinceIso = new Date(now - lookbackHours * 60 * 60 * 1000).toISOString();
  const allSubCategories = Object.values(CATEGORY_TREE).flat();

  const { data: analysisRows, error: analysisError } = await admin
    .from('hourly_analysis')
    .select('sub_category, analyzed_at')
    .in('country', MARKET_ANALYSIS_COUNTRIES)
    .in('sub_category', allSubCategories)
    .gte('analyzed_at', sinceIso)
    .order('analyzed_at', { ascending: false })
    .limit(50000);

  if (analysisError) {
    throw new Error(analysisError.message);
  }

  const selectionByBig = selectTopSubCategoriesByBigCategory(analysisRows || [], {
    perBigCategoryLimit,
  });
  const selectedSubCategories = [...selectionByBig.values()].flat();

  return {
    sinceIso,
    selectionByBig,
    selectedSubCategories,
  };
}
