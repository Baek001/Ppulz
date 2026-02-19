const { OpenAI } = require('openai');
// require('dotenv').config({ path: '.env.local' });

async function testOpenAI() {
    console.log('Testing OpenAI API...');
    console.log('Key starts with:', process.env.OPENAI_API_KEY?.substring(0, 10));

    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: 'Hello, are you working?' }],
        });
        console.log('Success:', response.choices[0].message.content);
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

testOpenAI();
