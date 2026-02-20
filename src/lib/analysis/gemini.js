function tryParseJson(text) {
  if (!text || typeof text !== 'string') return null;

  const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // continue
  }

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const slice = cleaned.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(slice);
    } catch {
      // continue
    }
  }

  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }

  return null;
}

function buildPrompt(subCategory, newsItems) {
  const sampleItems = (newsItems || [])
    .slice(0, 16)
    .map((item) => `- [${item.source_type || 'news'}] ${item.title}: ${item.snippet || ''}`)
    .join('\n');

  return `
You are a financial/policy analyst for a Korean dashboard service.
Analyze the mixed list of news and policy/bill items for category "${subCategory}".

Data:
${sampleItems}

Rules:
- score: integer 0..100
- label: "opportunity" | "risk" | "mixed" | "uncertain"
- comment: one concise Korean sentence under 70 chars
- references: up to 4 news + up to 2 bills from given items only
- reference fields: title, url, source_type(news|bill)
- score must be evidence-based from provided items, not a fixed default value
- avoid repeatedly returning the same neutral score unless evidence is truly identical

Return strict JSON only:
{
  "score": 50,
  "label": "mixed",
  "comment": "수요와 규제 이슈가 혼재되어 변동성이 큽니다.",
  "confidence": "low|medium|high",
  "references": [
    { "title": "string", "url": "string", "source_type": "news" },
    { "title": "string", "url": "string", "source_type": "bill" }
  ]
}
`;
}

function clampScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 50;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeReferenceList(references) {
  if (!Array.isArray(references)) return [];

  const seen = new Set();
  const news = [];
  const bills = [];

  for (const item of references) {
    if (!item?.title || !item?.url) continue;
    const sourceType = item?.source_type === 'bill' ? 'bill' : 'news';
    const key = `${sourceType}::${item.url}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const normalized = {
      title: String(item.title),
      url: String(item.url),
      source_type: sourceType,
    };

    if (sourceType === 'news' && news.length < 4) news.push(normalized);
    if (sourceType === 'bill' && bills.length < 2) bills.push(normalized);
    if (news.length >= 4 && bills.length >= 2) break;
  }

  return [...news, ...bills];
}

function normalizeResult(subCategory, country, data, fallbackItems = []) {
  const labelMap = {
    opportunity: '기회',
    risk: '위험',
    mixed: '혼합',
    uncertain: '불확실',
  };

  const rawLabel = String(data?.label || '').toLowerCase();
  const label = labelMap[rawLabel] || data?.label || '혼합';
  const comment = typeof data?.comment === 'string' && data.comment.trim()
    ? data.comment.trim()
    : '수집 데이터 기준으로 변동성 관리가 필요합니다.';
  const confidence = typeof data?.confidence === 'string' ? data.confidence : 'medium';
  const references = normalizeReferenceList(data?.references);

  const fallbackReferences = normalizeReferenceList(
    (fallbackItems || []).map((item) => ({
      title: item.title,
      url: item.url,
      source_type: item.source_type,
    })),
  );

  const mergedReferences = normalizeReferenceList([...references, ...fallbackReferences]);

  return {
    sub_category: subCategory,
    country,
    analyzed_at: new Date().toISOString(),
    score: clampScore(data?.score),
    label,
    comment,
    confidence,
    references: mergedReferences,
  };
}

function analyzeWithKeywordFallback(newsItems = []) {
  const positiveWords = [
    '상승',
    '호재',
    '개선',
    '증가',
    '승인',
    '통과',
    '확대',
    '완화',
    'rise',
    'increase',
    'approval',
    'growth',
  ];
  const negativeWords = [
    '하락',
    '악재',
    '감소',
    '지연',
    '위험',
    '규제',
    '제재',
    '리콜',
    'fall',
    'decrease',
    'delay',
    'risk',
    'regulation',
    'sanction',
    'recall',
  ];

  let positive = 0;
  let negative = 0;

  for (const item of newsItems) {
    const text = `${item?.title || ''} ${item?.snippet || ''}`.toLowerCase();
    for (const word of positiveWords) {
      if (text.includes(word.toLowerCase())) positive += 1;
    }
    for (const word of negativeWords) {
      if (text.includes(word.toLowerCase())) negative += 1;
    }
  }

  const score = clampScore(50 + (positive - negative) * 4);
  let label = 'mixed';
  if (score >= 65) label = 'opportunity';
  if (score <= 35) label = 'risk';

  const comment =
    label === 'opportunity'
      ? '긍정 신호가 우세하지만 단기 과열 여부를 확인하세요.'
      : label === 'risk'
        ? '부정 신호가 우세해 보수적 대응이 필요합니다.'
        : '호재와 악재가 혼재되어 변동성이 큰 구간입니다.';

  return {
    score,
    label,
    comment,
    confidence: 'low',
    references: newsItems
      .filter((item) => item?.title && item?.url && item?.source_type)
      .slice(0, 6)
      .map((item) => ({
        title: item.title,
        url: item.url,
        source_type: item.source_type === 'bill' ? 'bill' : 'news',
      })),
  };
}

export function analyzeWithKeywordFallbackScore(newsItems = []) {
  return analyzeWithKeywordFallback(newsItems);
}

async function analyzeWithOpenAI(subCategory, newsItems, country) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { error: 'missing_openai_key' };

  const prompt = buildPrompt(subCategory, newsItems);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Return JSON only.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    return { error: `openai_http_${response.status}` };
  }

  const payload = await response.json().catch(() => null);
  const content = payload?.choices?.[0]?.message?.content || '';
  const data = tryParseJson(content);
  if (!data) return { error: 'invalid_json_openai' };

  return {
    ...normalizeResult(subCategory, country, data, newsItems),
    provider: 'openai',
  };
}

async function analyzeWithGemini(subCategory, newsItems, country) {
  const apiKey = process.env.GOOGLE_GEMINI_KEY;
  if (!apiKey) return { error: 'missing_gemini_key' };

  const prompt = buildPrompt(subCategory, newsItems);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
    },
  );

  if (!response.ok) {
    return { error: `gemini_http_${response.status}` };
  }

  const payload = await response.json().catch(() => null);
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const data = tryParseJson(text);
  if (!data) return { error: 'invalid_json_gemini' };

  return {
    ...normalizeResult(subCategory, country, data, newsItems),
    provider: 'gemini',
  };
}

export async function analyzeNews(subCategory, newsItems, country = 'mix') {
  if (!Array.isArray(newsItems) || newsItems.length === 0) {
    return null;
  }

  try {
    const openaiResult = await analyzeWithOpenAI(subCategory, newsItems, country);
    if (openaiResult && !openaiResult.error) {
      return openaiResult;
    }

    const geminiResult = await analyzeWithGemini(subCategory, newsItems, country);
    if (geminiResult && !geminiResult.error) {
      return geminiResult;
    }

    const fallbackData = analyzeWithKeywordFallback(newsItems);
    return {
      ...normalizeResult(subCategory, country, fallbackData, newsItems),
      provider: 'fallback_keyword',
    };
  } catch (error) {
    console.error(`Analysis failed for ${subCategory}:`, error);
    const fallbackData = analyzeWithKeywordFallback(newsItems);
    return {
      ...normalizeResult(subCategory, country, fallbackData, newsItems),
      provider: 'fallback_keyword',
    };
  }
}

