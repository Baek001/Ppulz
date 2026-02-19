import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Manually parse .env.local
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            let value = parts.slice(1).join('=').trim();
            // Strip quotes
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            process.env[key] = value;
        }
    });
}

// Mock data (mixed references)
const mockItems = [
    { title: '코스피 3000 돌파 가능성', snippet: '증권가 전망 긍정적...', source_type: 'news', url: 'http://news1.com' },
    { title: '미국 연준 금리 인하 시사', snippet: '파월 의장 발언 주목...', source_type: 'news', url: 'http://news2.com' },
    { title: '금융투자소득세 폐지 법안', snippet: '여야 합의 난항...', source_type: 'bill', url: 'http://bill1.com' },
    { title: 'US SEC Crypto Regulation Bill', snippet: 'New framework proposed...', source_type: 'bill', url: 'http://bill2.com' }
];

async function testGemini() {
    console.log('Testing Gemini Analysis...');
    try {
        // Dynamic import AFTER env is set
        const { analyzeNews } = await import('../src/lib/analysis/gemini.js');

        const result = await analyzeNews('주식', mockItems, 'mix');
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Test Failed:', error);
    }
}

testGemini();
