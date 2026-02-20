import { CATEGORY_TREE } from '@/lib/constants/categories';

const CANONICAL_SUB_CATEGORIES = Object.freeze(
  Object.values(CATEGORY_TREE).flat().filter((item) => typeof item === 'string'),
);

const CANONICAL_SET = new Set(CANONICAL_SUB_CATEGORIES);

export const CATEGORY_ALIAS_MAP = Object.freeze({
  외한: '외환',
  etf: 'ETF',
  Etf: 'ETF',
  pf: 'PF',
  Pf: 'PF',
  ai: 'AI',
  Ai: 'AI',
});

const LOWER_CASE_ALIAS_MAP = new Map(
  Object.entries(CATEGORY_ALIAS_MAP).map(([key, value]) => [key.toLowerCase(), value]),
);

const LOWER_CASE_CANONICAL_MAP = new Map(
  CANONICAL_SUB_CATEGORIES.filter((item) => /^[A-Za-z]+$/.test(item)).map((item) => [
    item.toLowerCase(),
    item,
  ]),
);

const SUB_TO_BIG_MAP = new Map();
for (const [bigCategory, subCategories] of Object.entries(CATEGORY_TREE)) {
  for (const subCategory of subCategories) {
    SUB_TO_BIG_MAP.set(subCategory, bigCategory);
  }
}

export function normalizeSubCategory(value) {
  if (typeof value !== 'string') return '';

  const raw = value.trim();
  if (!raw) return '';
  if (CANONICAL_SET.has(raw)) return raw;

  if (CATEGORY_ALIAS_MAP[raw]) {
    return CATEGORY_ALIAS_MAP[raw];
  }

  const aliasByLower = LOWER_CASE_ALIAS_MAP.get(raw.toLowerCase());
  if (aliasByLower) return aliasByLower;

  const canonicalByLower = LOWER_CASE_CANONICAL_MAP.get(raw.toLowerCase());
  if (canonicalByLower) return canonicalByLower;

  return raw;
}

export function getCategoryVariants(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  const canonical = normalizeSubCategory(raw);
  const variants = new Set();

  if (raw) variants.add(raw);
  if (canonical) variants.add(canonical);

  for (const [alias, target] of Object.entries(CATEGORY_ALIAS_MAP)) {
    if (target === canonical) variants.add(alias);
  }

  if (/^[A-Za-z]+$/.test(canonical)) {
    variants.add(canonical.toLowerCase());
    variants.add(canonical.toUpperCase());
  }

  return Array.from(variants).filter(Boolean);
}

export function getSiblingSubCategories(subCategory, limit = 2) {
  const canonical = normalizeSubCategory(subCategory);
  const bigCategory = SUB_TO_BIG_MAP.get(canonical);
  if (!bigCategory) return [];

  const siblings = (CATEGORY_TREE[bigCategory] || [])
    .filter((item) => item !== canonical)
    .slice(0, Math.max(0, limit));

  return siblings;
}

export function isKnownSubCategory(value) {
  return CANONICAL_SET.has(normalizeSubCategory(value));
}

