export const CATEGORY_TREE = Object.freeze({
  금융자산: ['주식', '채권', 'ETF', '금리', '외환', '파생'],
  디지털자산: ['코인', '스테이블코인', '거래소', '디파이', '지갑', '보안'],
  실물상품소비: ['식품', '유통', '전자제품', '화장품', '생활용품', '리콜'],
  부동산인프라: ['주거', '상업용', '임대차', '재건축', '재개발', 'PF'],
  에너지환경: ['전력', '가스', '석유', '신재생', '탄소', '광물'],
  산업기술규제: ['AI', '데이터', '개인정보', '플랫폼', '반도체', '수출통제'],
  모빌리티물류: ['자동차', '전기차', '배터리', '자율주행', '항공', '해운'],
  공공사회: ['세제', '노동', '보건', '교육', '재난안전', '국방'],
});

export const BIG_CATEGORIES = Object.freeze(Object.keys(CATEGORY_TREE));

export function isValidBigCategory(value) {
  return BIG_CATEGORIES.includes(value);
}

export function getSubCategoriesForBigCategory(bigCategory) {
  return CATEGORY_TREE[bigCategory] ?? [];
}

export function isValidSubCategory(bigCategory, subCategory) {
  return getSubCategoriesForBigCategory(bigCategory).includes(subCategory);
}
