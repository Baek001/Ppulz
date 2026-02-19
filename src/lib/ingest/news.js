import Parser from 'rss-parser';

const parser = new Parser();

// Google News RSS URL generator
const getGoogleNewsUrl = (keyword, country = 'kr') => {
    const hl = country === 'kr' ? 'ko' : 'en-US';
    const gl = country === 'kr' ? 'KR' : 'US';
    const ceid = country === 'kr' ? 'KR:ko' : 'US:en';
    return `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
};

export async function fetchNews(keyword, country = 'kr', explicitQuery = null) {
    try {
        const query = explicitQuery || keyword;
        const url = getGoogleNewsUrl(query, country);
        const feed = await parser.parseURL(url);

        return feed.items.map((item) => ({
            source_type: 'news',
            country,
            category: keyword, // Using keyword as category for mapping
            title: item.title,
            snippet: item.contentSnippet || item.content,
            url: item.link,
            published_at: new Date(item.pubDate).toISOString(),
        })).slice(0, 10); // Limit to top 10 recent
    } catch (error) {
        console.error(`Failed to fetch news for ${keyword}:`, error);
        return [];
    }
}
