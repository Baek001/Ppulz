// Imports removed to be dynamic
import { createClient } from '@supabase/supabase-js';
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
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            process.env[key] = value;
        }
    });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runIngestion() {
    console.log('Starting Manual Ingestion...');

    // Dynamic imports
    const { fetchNews } = await import('../src/lib/ingest/news.js');
    const { analyzeNews } = await import('../src/lib/analysis/gemini.js');
    const { SEARCH_QUERIES } = await import('../src/lib/constants/search_queries.js');

    // Hardcoded subcategories for testing
    const targetSubs = ['주식'];

    for (const sub of targetSubs) {
        console.log(`Processing ${sub}...`);

        // A. Fetch Mixed Data (KR News, US News, KR Bill, US Bill)
        const queries = SEARCH_QUERIES[sub] || { KR: sub, US: sub };

        console.log('- Fetching news/bills...');
        const requests = [
            fetchNews(sub, 'kr', queries.KR), // KR News
            fetchNews(sub, 'us', queries.US), // US News
            fetchNews(sub + ' 법안', 'kr', queries.KR ? `(${queries.KR}) AND (법안 OR 규제 OR 정책)` : `${sub} 법안 규제`), // KR Bill Proxy
            fetchNews(sub + ' Bill', 'us', queries.US ? `(${queries.US}) AND (bill OR regulation OR legislation)` : `${sub} bill regulation`) // US Bill Proxy
        ];

        const [newsKR, newsUS, billsKR, billsUS] = await Promise.all(requests);
        console.log(`  Fetched: KR News(${newsKR.length}), US News(${newsUS.length}), KR Bills(${billsKR.length}), US Bills(${billsUS.length})`);

        // Label items
        const labelItems = (items, type) => items.map(i => ({ ...i, source_type: type }));
        const allItems = [
            ...labelItems(newsKR, 'news'),
            ...labelItems(newsUS, 'news'),
            ...labelItems(billsKR, 'bill'),
            ...labelItems(billsUS, 'bill')
        ];

        if (allItems.length > 0) {
            console.log(`- Inserting ${allItems.length} raw items...`);
            const { error: insertError } = await supabase
                .from('raw_items')
                .insert(allItems)
                .select();

            if (insertError) {
                console.log(`  (Note: Insert error usually due to dups, ignoring): ${insertError.message}`);
            }

            // B. Analyze
            console.log(`- Analyzing with Gemini...`);
            const analysisResult = await analyzeNews(sub, allItems, 'mix');

            if (analysisResult && !analysisResult.error) {
                console.log(`  Analysis Success! Score: ${analysisResult.score}`);

                const payload = {
                    country: 'mix',
                    sub_category: sub,
                    score: analysisResult.score,
                    label: analysisResult.label,
                    comment: analysisResult.comment,
                    references: analysisResult.references
                };

                let { error: analyzeError } = await supabase
                    .from('hourly_analysis')
                    .insert(payload);

                if (analyzeError) {
                    console.error(`  Analysis Insert Failed: ${analyzeError.message}`);
                    if (analyzeError.message.includes('references') || analyzeError.code === '42703') {
                        console.log(`  Retrying without references...`);
                        delete payload.references;
                        const { error: retryError } = await supabase
                            .from('hourly_analysis')
                            .insert(payload);
                        if (!retryError) {
                            console.log(`  Retry Success!`);
                        } else {
                            console.error(`  Retry Failed: ${retryError.message}`);
                        }
                    }
                } else {
                    console.log(`  Analysis Saved Successfully.`);
                }
            } else {
                console.error(`  Analysis Failed: ${analysisResult?.error}`);
            }
        } else {
            console.log(`- No items found.`);
        }
    }
    console.log('Manual Ingestion Complete.');
}

runIngestion();
