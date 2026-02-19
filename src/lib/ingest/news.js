// Google News RSS URL generator
const getGoogleNewsUrl = (keyword, country = 'kr') => {
    const hl = country === 'kr' ? 'ko' : 'en-US';
    const gl = country === 'kr' ? 'KR' : 'US';
    const ceid = country === 'kr' ? 'KR:ko' : 'US:en';
    return `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
};

function extractTagContent(xml, tagName) {
    const regex = new RegExp(`<${tagName}[^>]*>(.*?)</${tagName}>`, 'gs');
    const match = regex.exec(xml);
    return match ? match[1].trim() : '';
}

function parseRSS(xmlText) {
    const items = [];
    const itemRegex = /<item>(.*?)<\/item>/gs;
    let match;

    while ((match = itemRegex.exec(xmlText)) !== null) {
        const itemContent = match[1];
        const title = extractTagContent(itemContent, 'title');
        const link = extractTagContent(itemContent, 'link');
        const pubDate = extractTagContent(itemContent, 'pubDate');
        // description often contains HTML, strip tags if needed or take snippet
        // Google News RSS description is usually HTML with links.
        // Identify pure text description is hard with regex, let's just take raw description
        // and caller can clean it up effectively if needed, but previously we used contentSnippet.
        // For simple usage, raw description is often enough or title is main info.
        const description = extractTagContent(itemContent, 'description');

        if (title && link) {
            items.push({
                title,
                link,
                pubDate,
                content: description,
                contentSnippet: description.replace(/<[^>]+>/g, '') // Basic strip tags
            });
        }
    }
    return items;
}

export async function fetchNews(keyword, country = 'kr', explicitQuery = null) {
    try {
        const query = explicitQuery || keyword;
        const url = getGoogleNewsUrl(query, country);

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch RSS: ${response.status} ${response.statusText}`);
        }

        const xmlText = await response.text();
        const items = parseRSS(xmlText);

        return items.map((item) => ({
            source_type: 'news',
            country,
            category: keyword, // Using keyword as category for mapping
            title: item.title,
            snippet: item.contentSnippet || item.content,
            url: item.link,
            published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        })).slice(0, 10); // Limit to top 10 recent
    } catch (error) {
        console.error(`Failed to fetch news for ${keyword}:`, error);
        return [];
    }
}
