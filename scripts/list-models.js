import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Manually parse .env.local
const envPath = path.resolve(__dirname, '../.env.local');
let apiKey = process.env.GOOGLE_GEMINI_KEY;

if (!apiKey && fs.existsSync(envPath)) {
    console.log('Reading .env.local...');
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            let value = parts.slice(1).join('=').trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            if (key === 'GOOGLE_GEMINI_KEY') {
                apiKey = value;
            }
        }
    });
}

if (!apiKey) {
    console.error('GOOGLE_GEMINI_KEY not found in environment or .env.local');
    process.exit(1);
}

// Mask key for log
console.log(`Using API Key: ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`);

async function listModels() {
    const genAI = new GoogleGenerativeAI(apiKey);
    console.log('Fetching available models...');
    try {
        // There isn't a direct listModels method exposed on the instance in some versions,
        // but let's try via the model manager if available, or just a known endpoint workaround?
        // Actually, the error message SUGGESTED calling ListModels.
        // The Node.js SDK doesn't always expose it easily on the main class?
        // Let's try to get a model and assume it works if we don't get a 403?
        // No, we want to list them.
        // The SDK has `getGenerativeModel`, but maybe `makeRequest`?

        // As of v0.1.0+, there isn't a simple listModels helper in the high-level SDK.
        // But the error message said "Call ListModels".
        // Let's try a simple fetch to the REST API directly.

        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.models) {
            console.log(`Found ${data.models.length} models.`);
            fs.writeFileSync('models.json', JSON.stringify(data.models, null, 2));
            console.log('Saved to models.json');
        } else {
            console.error('Failed to list models:', JSON.stringify(data, null, 2));
        }

    } catch (error) {
        console.error('Error listing models:', error);
    }
}

listModels();
