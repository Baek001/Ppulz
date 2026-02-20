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
너는 Ppulz의 분석가다. 아래 뉴스/법안 목록을 보고 "${subCategory}"의 전반 분위기를 평가해라.

데이터:
${newsSummary}

규칙:
- score: 0~100 정수
- label: "기회" | "위험" | "혼합" | "불확실"
- comment: 한국어 한 줄, 60자 이내
- references: 뉴스 2개 + 법안 2개 (가능한 범위에서)

출력은 반드시 JSON만:
{
  "score": 70,
  "label": "혼합",
  "comment": "요약 코멘트",
  "confidence": "low|medium|high",
  "references": [
    { "title": "string", "url": "string", "source_type": "news" },
    { "title": "string", "url": "string", "source_type": "bill" }
  ]
}
`;
}

async function analyzeWithOpenAI(subCategory, newsItems) {
    const openai = getOpenAIClient();
    if (!openai) return { error: 'missing_openai_key' };

    const prompt = buildPrompt(subCategory, newsItems);

    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: 'JSON만 출력하세요.' },
            { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
    });

    const content = response.choices?.[0]?.message?.content || '';
    const data = tryParseJson(content);
    if (!data) {
        return { error: 'INVALID_JSON' };
    }

    if (!data.references) data.references = [];
    return {
        sub_category: subCategory,
        country: 'mix',
        analyzed_at: new Date().toISOString(),
        score: data.score,
        label: data.label,
        comment: data.comment,
        confidence: data.confidence,
        references: data.references,
    };
}

async function analyzeWithGemini(subCategory, newsItems) {
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
        return { error: 'INVALID_JSON' };
    }

    if (!data.references) data.references = [];
    return {
        sub_category: subCategory,
        country: 'mix',
        analyzed_at: new Date().toISOString(),
        score: data.score,
        label: data.label,
        comment: data.comment,
        confidence: data.confidence,
        references: data.references,
    };
}

export async function analyzeNews(subCategory, newsItems, country = 'kr') {
    if (!newsItems || newsItems.length === 0) {
        return null;
    }

    try {
        const openaiResult = await analyzeWithOpenAI(subCategory, newsItems);
        if (openaiResult && !openaiResult.error) {
            return openaiResult;
        }

        const geminiResult = await analyzeWithGemini(subCategory, newsItems);
        if (geminiResult && !geminiResult.error) {
            return geminiResult;
        }

        return { error: openaiResult?.error || geminiResult?.error || 'analysis_failed' };
    } catch (error) {
        console.error(`Analysis failed for ${subCategory}:`, error);
        return { error: error?.message || 'analysis_failed' };
    }
}
