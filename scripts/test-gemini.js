const { GoogleGenerativeAI } = require('@google/generative-ai');
// require('dotenv').config({ path: '.env.local' });

async function testGemini() {
    console.log('Testing Gemini API...');
    const key = process.env.GOOGLE_GEMINI_KEY;
    console.log('Key starts with:', key?.substring(0, 5));

    if (!key) {
        console.error('GOOGLE_GEMINI_KEY is missing');
        return;
    }

    const genAI = new GoogleGenerativeAI(key);

    const models = ["gemini-2.5-flash", "gemini-2.0-flash-exp", "gemini-1.5-flash"];

    for (const mName of models) {
        console.log(`Trying model: ${mName}`);
        try {
            const model = genAI.getGenerativeModel({ model: mName });
            const result = await model.generateContent("Hello?");
            const response = await result.response;
            console.log(`Success with ${mName}:`, response.text());
            break;
        } catch (e) {
            console.error(`Failed ${mName}:`, e.message); // Not full stack
        }
    }
}

testGemini();
