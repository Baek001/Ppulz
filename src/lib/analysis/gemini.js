const OpenAIModule = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const OpenAI = OpenAIModule?.default || OpenAIModule;

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new OpenAI({ apiKey });
}

function getGeminiClient() {
  const apiKey = process.env.GOOGLE_GEMINI_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenerativeAI(apiKey);
}

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
  const newsSummary = newsItems.map((item) => `- ${item.title}: ${item.snippet}`).join('\n');
  return `
You are Ppulz market analyst.
Analyze the mixed list of news and policy/bill items for category "${subCategory}".

Data:
${newsSummary}

Rules:
- score: integer 0..100
- label: "opportunity" | "risk" | "mixed" | "uncertain"
- comment: one concise Korean sentence under 60 chars
- references: up to 2 news + up to 2 bills from given items

Return strict JSON only:
{
  "score": 70,
  "label": "mixed",
  "comment": "요약 코멘트",
  "confidence": "low|medium|high",
  "references": [
    { "title": "string", "url": "string", "source_type": "news" },
    { "title": "string", "url": "string", "source_type": "bill" }
  ]
}
`;
}

function normalizeResult(subCategory, country, data) {
  const scoreNum = Number(data?.score);
  const score = Number.isFinite(scoreNum) ? Math.max(0, Math.min(100, Math.round(scoreNum))) : 50;
  const labelMap = {
    opportunity: '기회',
    risk: '위험',
    mixed: '혼합',
    uncertain: '불확실',
  };
  const rawLabel = String(data?.label || '').toLowerCase();
  const label = labelMap[rawLabel] || data?.label || '혼합';
  const comment = typeof data?.comment === 'string' ? data.comment : '';
  const confidence = typeof data?.confidence === 'string' ? data.confidence : 'medium';
  const references = Array.isArray(data?.references) ? data.references : [];

  return {
    sub_category: subCategory,
    country,
    analyzed_at: new Date().toISOString(),
    score,
    label,
    comment,
    confidence,
    references,
  };
}

async function analyzeWithOpenAI(subCategory, newsItems, country) {
  const openai = getOpenAIClient();
  if (!openai) return { error: 'missing_openai_key' };

  const prompt = buildPrompt(subCategory, newsItems);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'Return JSON only.' },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  });

  const content = response.choices?.[0]?.message?.content || '';
  const data = tryParseJson(content);
  if (!data) {
    return { error: 'invalid_json_openai' };
  }

  return normalizeResult(subCategory, country, data);
}

async function analyzeWithGemini(subCategory, newsItems, country) {
  const genAI = getGeminiClient();
  if (!genAI) return { error: 'missing_gemini_key' };

  const prompt = buildPrompt(subCategory, newsItems);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });
  const response = await result.response;
  const text = response.text();
  const data = tryParseJson(text);
  if (!data) {
    return { error: 'invalid_json_gemini' };
  }

  return normalizeResult(subCategory, country, data);
}

export async function analyzeNews(subCategory, newsItems, country = 'mix') {
  if (!newsItems || newsItems.length === 0) {
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

    return { error: openaiResult?.error || geminiResult?.error || 'analysis_failed' };
  } catch (error) {
    console.error(`Analysis failed for ${subCategory}:`, error);
    return { error: error?.message || 'analysis_failed' };
  }
}
