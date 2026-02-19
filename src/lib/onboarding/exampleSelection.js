const TOTAL_CARDS = 12;
const TARGET_PER_TYPE = 6;
const MIN_MATCHED = 7;

function shuffle(list) {
  const copied = [...list];

  for (let index = copied.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copied[index], copied[randomIndex]] = [copied[randomIndex], copied[index]];
  }

  return copied;
}

function buildPairKey(bigCategory, subCategory) {
  return `${bigCategory}::${subCategory}`;
}

function buildPairSet(subCategories) {
  return new Set(
    subCategories
      .filter((item) => item && typeof item.big_category === 'string' && typeof item.sub_category === 'string')
      .map((item) => buildPairKey(item.big_category, item.sub_category)),
  );
}

function isMatchedCard(card, matchedPairSet) {
  return matchedPairSet.has(buildPairKey(card.big_category, card.sub_category));
}

function countMatched(cards, matchedPairSet) {
  return cards.filter((card) => isMatchedCard(card, matchedPairSet)).length;
}

function splitByType(cards) {
  const buckets = {
    news: [],
    bill: [],
  };

  cards.forEach((card) => {
    if (card.card_type === 'news' || card.card_type === 'bill') {
      buckets[card.card_type].push(card);
    }
  });

  return buckets;
}

function dedupeByCardId(cards) {
  const cardMap = new Map();
  cards.forEach((card) => {
    cardMap.set(card.card_id, card);
  });
  return [...cardMap.values()];
}

function selectBalanced(newsPool, billPool) {
  const selectedNews = newsPool.slice(0, Math.min(TARGET_PER_TYPE, newsPool.length));
  const selectedBill = billPool.slice(0, Math.min(TARGET_PER_TYPE, billPool.length));
  const selected = [...selectedNews, ...selectedBill];

  if (selected.length < TOTAL_CARDS) {
    const selectedIdSet = new Set(selected.map((card) => card.card_id));
    const leftovers = shuffle([...newsPool, ...billPool]).filter((card) => !selectedIdSet.has(card.card_id));
    selected.push(...leftovers.slice(0, TOTAL_CARDS - selected.length));
  }

  return dedupeByCardId(selected).slice(0, TOTAL_CARDS);
}

function ensureBothTypes(selected, allNews, allBill, matchedPairSet) {
  const selectedNewsCount = selected.filter((card) => card.card_type === 'news').length;
  const selectedBillCount = selected.filter((card) => card.card_type === 'bill').length;

  const selectedIdSet = new Set(selected.map((card) => card.card_id));

  if (selectedNewsCount === 0 && allNews.length > 0) {
    const replacement = allNews.find((card) => !selectedIdSet.has(card.card_id));
    if (replacement) {
      const replaceIndex = selected.findIndex((card) => card.card_type === 'bill' && !isMatchedCard(card, matchedPairSet));
      const index = replaceIndex >= 0 ? replaceIndex : selected.findIndex((card) => card.card_type === 'bill');
      if (index >= 0) {
        selected[index] = replacement;
      }
    }
  }

  if (selectedBillCount === 0 && allBill.length > 0) {
    const replacement = allBill.find((card) => !selectedIdSet.has(card.card_id));
    if (replacement) {
      const replaceIndex = selected.findIndex((card) => card.card_type === 'news' && !isMatchedCard(card, matchedPairSet));
      const index = replaceIndex >= 0 ? replaceIndex : selected.findIndex((card) => card.card_type === 'news');
      if (index >= 0) {
        selected[index] = replacement;
      }
    }
  }

  return dedupeByCardId(selected).slice(0, TOTAL_CARDS);
}

function selectMatchPriority(matchedCards, unmatchedCards) {
  return [...shuffle(matchedCards), ...shuffle(unmatchedCards)].slice(0, TOTAL_CARDS);
}

export function selectExampleCards(candidates, selectedSubCategories) {
  const validCandidates = candidates.filter(
    (card) => card.card_type === 'news' || card.card_type === 'bill',
  );

  if (validCandidates.length < TOTAL_CARDS) {
    throw new Error('Not enough example cards available.');
  }

  const selectedPairSet = buildPairSet(selectedSubCategories);

  const matchedCandidates = validCandidates.filter((card) => isMatchedCard(card, selectedPairSet));
  const unmatchedCandidates = validCandidates.filter((card) => !isMatchedCard(card, selectedPairSet));

  if (matchedCandidates.length < MIN_MATCHED) {
    throw new Error('Matched example cards are fewer than required minimum.');
  }

  const matchedByType = splitByType(matchedCandidates);
  const unmatchedByType = splitByType(unmatchedCandidates);

  const newsPool = [...shuffle(matchedByType.news), ...shuffle(unmatchedByType.news)];
  const billPool = [...shuffle(matchedByType.bill), ...shuffle(unmatchedByType.bill)];

  let selected = selectBalanced(newsPool, billPool);
  selected = ensureBothTypes(selected, newsPool, billPool, selectedPairSet);

  if (selected.length === TOTAL_CARDS && countMatched(selected, selectedPairSet) >= MIN_MATCHED) {
    return shuffle(selected);
  }

  selected = selectMatchPriority(matchedCandidates, unmatchedCandidates);
  selected = ensureBothTypes(selected, newsPool, billPool, selectedPairSet);

  if (selected.length !== TOTAL_CARDS) {
    throw new Error('Failed to assemble 12 example cards.');
  }

  if (countMatched(selected, selectedPairSet) < MIN_MATCHED) {
    throw new Error('Selected cards violate minimum matched rule.');
  }

  return shuffle(selected);
}
