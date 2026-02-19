const Parser = require('rss-parser');
const parser = new Parser();

const getGoogleNewsUrl = (keyword, country = 'kr') => {
    const hl = country === 'kr' ? 'ko' : 'en-US';
    const gl = country === 'kr' ? 'KR' : 'US';
    const ceid = country === 'kr' ? 'KR:ko' : 'US:en';
    // Use the search URL format
    return `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
};

async function testFetch() {
    const keyword = '주식';
    console.log(`Fetching news for: ${keyword}`);

    // Test Bill Proxy
    const billQuery = `${keyword} 법안 규제`;
    const url = getGoogleNewsUrl(billQuery, 'kr');
    console.log(`URL: ${url}`);

    try {
        const feed = await parser.parseURL(url);
        console.log(`Success! Found ${feed.items.length} items.`);
        if (feed.items.length > 0) {
            console.log('First item:', feed.items[0].title);
            console.log('Snippet:', feed.items[0].contentSnippet);
        } else {
            console.log('No items found for bill query.');
        }
    } catch (e) {
        console.error('Fetch failed:', e);
    }
}

testFetch();
