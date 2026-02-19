import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

function getProvider() {
    const provider = (process.env.AI_PROVIDER || 'auto').toLowerCase();
    if (provider === 'gemini' || provider === 'openai' || provider === 'auto') {
        return provider;
    }
    return 'auto';
}

function getGeminiKey() {
    return process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_KEY || null;
}

function getOpenAIKey() {
    return process.env.OPENAI_API_KEY || null;
}

async function analyzeWithGemini(items, category, country) {
    const apiKey = getGeminiKey();
    if (!apiKey) {
        return null;
    }

    const contextText = items
        .map((item, idx) => `[${idx + 1}] ${item.title} (${item.published_at?.substring(0, 10) || 'unknown'})`)
        .join('\n');

    const prompt = `
You are an AI analyst for a political/economic monitoring dashboard called "Ppulz".

Topic: ${category}
Country: ${country === 'kr' ? 'South Korea' : 'USA'}

Analyze the following recent news/bills headlines to determine the "Pulse Score" (0-100).
- 0-20: Very Calm / No significant activity
- 21-40: Minor discussions
- 41-60: Moderate activity / Standard news flow
- 61-80: High activity / Significant issues emerging
- 81-100: Critical / Breaking News / Major legislative movement

Also provide:
- label: short status text
- comment: one sentence in Korean
- confidence: 0.0 to 1.0

Recent Items:
${contextText}

Return strict JSON only:
{
  "score": number,
  "label": string,
  "comment": string,
  "confidence": number
}
`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(text);

    return {
        score: Number.isFinite(data.score) ? data.score : null,
        label: data.label || '분석 결과',
        comment: data.comment || '분석 코멘트가 없습니다.',
        confidence: Number.isFinite(data.confidence) ? data.confidence : 0,
    };
}

async function analyzeWithOpenAI(items, category, country) {
    const apiKey = getOpenAIKey();
    if (!apiKey) {
        return null;
    }

    const openai = new OpenAI({ apiKey });
    const contextText = items
        .map((item, idx) => `[${idx + 1}] ${item.title} (${item.published_at?.substring(0, 10) || 'unknown'})`)
        .join('\n');

    const prompt = `
You are an AI analyst for a political/economic monitoring dashboard called "Ppulz".

Topic: ${category}
Country: ${country === 'kr' ? 'South Korea' : 'USA'}

Analyze the following recent news/bills headlines to determine the "Pulse Score" (0-100).
- 0-20: Very Calm / No significant activity
- 21-40: Minor discussions
- 41-60: Moderate activity / Standard news flow
- 61-80: High activity / Significant issues emerging
- 81-100: Critical / Breaking News / Major legislative movement

Also provide a Label (e.g., "Critical", "Attention", "Calm") and a 1-sentence Comment (in Korean).

Recent Items:
${contextText}

Response Format (JSON):
{
  "score": number,
  "label": string,
  "comment": string,
  "confidence": number
}
`;

    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: 'You are a helpful analyst. Output JSON only.' },
            { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5,
    });

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content);

    return {
        score: parsed.score,
        label: parsed.label,
        comment: parsed.comment,
        confidence: parsed.confidence,
    };
}

export async function analyzeTopic(items, category, country) {
    if (!items || items.length === 0) {
        return {
            score: null,
            label: '데이터 부족',
            comment: '최근 수집된 데이터가 없어 분석할 수 없습니다.',
            confidence: 0,
        };
    }

    const provider = getProvider();

    try {
        if (provider === 'gemini') {
            const result = await analyzeWithGemini(items, category, country);
            if (result) return result;
        }

        if (provider === 'openai') {
            const result = await analyzeWithOpenAI(items, category, country);
            if (result) return result;
        }

        if (provider === 'auto') {
            const geminiResult = await analyzeWithGemini(items, category, country);
            if (geminiResult) return geminiResult;

            const openaiResult = await analyzeWithOpenAI(items, category, country);
            if (openaiResult) return openaiResult;
        }

        return {
            score: null,
            label: '분석 비활성',
            comment: 'GEMINI_API_KEY 또는 OPENAI_API_KEY가 없어 AI 분석을 건너뜁니다.',
            confidence: 0,
        };
    } catch (error) {
        console.error('Analysis failed:', error);
        return {
            score: null,
            label: '분석 실패',
            comment: 'AI 분석 중 오류가 발생했습니다.',
            confidence: 0,
        };
    }
}
