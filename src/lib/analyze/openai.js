import OpenAI from 'openai';

function getOpenAIClient() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return null;
    }
    return new OpenAI({ apiKey });
}

export async function analyzeTopic(items, category, country) {
    const openai = getOpenAIClient();
    if (!openai) {
        return {
            score: null,
            label: '분석 비활성',
            comment: 'OPENAI_API_KEY가 없어 AI 분석을 건너뜁니다.',
            confidence: 0,
        };
    }

    if (!items || items.length === 0) {
        return {
            score: null,
            label: '데이터 부족',
            comment: '최근 수집된 데이터가 없어 분석할 수 없습니다.',
            confidence: 0,
        };
    }

    const contextText = items.map((item, idx) =>
        `[${idx + 1}] ${item.title} (${item.published_at.substring(0, 10)})`
    ).join('\n');

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
      "confidence": number (0.0-1.0)
    }
    `;

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o', // Or gpt-3.5-turbo if cost is concern
            messages: [
                { role: 'system', content: 'You are a helpful analyst. Output JSON only.' },
                { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.5,
        });

        const content = response.choices[0].message.content;
        const result = JSON.parse(content);

        return {
            score: result.score,
            label: result.label,
            comment: result.comment,
            confidence: result.confidence
        };

    } catch (error) {
        console.error('Analysis failed:', error);
        return {
            score: null,
            label: '분석 실패',
            comment: 'AI 분석 중 오류가 발생했습니다.',
            confidence: 0
        };
    }
}
