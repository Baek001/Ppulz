
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_KEY);

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

export async function analyzeNews(subCategory, newsItems, country = 'kr') {
    if (!newsItems || newsItems.length === 0) {
        return null;
    }

    const newsSummary = newsItems.map(item => `- ${item.title}: ${item.snippet}`).join('\n');

    const prompt = `
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

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
        });

        const response = await result.response;
        const text = response.text();

        const data = tryParseJson(text);

        if (!data || typeof data !== 'object') {
            return { error: 'INVALID_JSON' };
        }

        // Ensure references exist
        if (!data.references) data.references = [];

        return {
            sub_category: subCategory,
            country,
            analyzed_at: new Date().toISOString(),
            score: data.score,
            label: data.label,
            comment: data.comment,
            confidence: data.confidence,
            references: data.references,
        };
    } catch (error) {
        console.error(`Gemini analysis failed for ${subCategory}:`, error);
        let errorMsg = error.message;
        if (error.response) {
            errorMsg += ' Raw: ' + await error.response.text();
        }
        return { error: errorMsg };
    }
}

