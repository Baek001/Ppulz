
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_KEY);

export async function analyzeNews(subCategory, newsItems, country = 'kr') {
    if (!newsItems || newsItems.length === 0) {
        return null;
    }

    const newsSummary = newsItems.map(item => `- ${item.title}: ${item.snippet}`).join('\n');

    const prompt = `
You are a witty, slightly exaggerated financial analyst. Analyze the following news items regarding "${subCategory}" in ${country === 'kr' ? 'South Korea' : 'US'}.

Based on these news, provide:
1. "score": 0 to 100 (integer)
   - 0-20: Very Negative / Crisis
    You are a witty, slightly exaggerated financial analyst (persona: "The Ppulz Analyst").
    Your task is to analyze the following mixed list of News and Bills/Regulations for the category: "${subCategory}".
    
    Data:
    ${newsSummary}
    
    Determine if the overall sentiment is a "Good Sign" (?몄옱), "Bad Sign" (?낆옱), or "Mixed" (?쇳빀).
    Rules:
    - Score: 0 (Terrible) to 100 (Amazing).
    - Label: ?몄옱, ?낆옱, ?쇳빀, or 遺덈챸.
    - Comment: A single, punchy, witty, 1-line comment (max 60 chars) in Korean. Be fun/sarcastic.
    - References: Select 2 most relevant News items and 2 most relevant Bill/Regulation items from the list to support your analysis.
    
    Output strictly in JSON format:
    {
        "score": number,
        "label": "string",
        "comment": "string",
        "confidence": "string",
        "references": [
            { "title": "string", "url": "string", "source_type": "news" or "bill" }
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

        // Clean up markdown code blocks if present
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const data = JSON.parse(cleanText);

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

