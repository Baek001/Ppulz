import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function analyzeNews(subCategory, newsItems, country = 'kr') {
    if (!newsItems || newsItems.length === 0) {
        return null;
    }

    const newsSummary = newsItems.map(item => `- ${item.title}: ${item.snippet}`).join('\n');

    const prompt = `
You are a sentiment analysis expert. Analyze the following news items regarding "${subCategory}" in ${country === 'kr' ? 'South Korea' : 'US'}.
Based on these news, provide a "sentiment score" from 0 to 100.
- 0-20: Very Negative / Crisis
- 21-40: Negative / Caution
- 41-60: Neutral / Mixed
- 61-80: Positive / Rising
- 81-100: Very Positive / Boom

Also provide a short "comment" (maximum 40 characters) summarizing the vibe.
And a "label" which is the score + "점" (e.g., "75점").

News Items:
${newsSummary}

Return JSON format:
{
  "score": number,
  "label": string,
  "comment": string
}
`;

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo', // Safer default
            messages: [
                { role: 'system', content: 'You are a helpful assistant that outputs JSON.' },
                { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' },
        });

        const content = response.choices[0].message.content;
        const result = JSON.parse(content);

        return {
            sub_category: subCategory,
            country,
            analyzed_at: new Date().toISOString(),
            score: result.score,
            label: result.label,
            comment: result.comment,
            // References to raw items could be stored if we had a relation, but for now flat is fine.
        };
    } catch (error) {
        console.error(`OpenAI analysis failed for ${subCategory}:`, error.message, error.response?.data);
        return null;
    }
}
