-- raw_items: News/Content storage
CREATE TABLE IF NOT EXISTS raw_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type TEXT NOT NULL, -- 'news', 'bill', etc.
    country TEXT NOT NULL, -- 'kr', 'us'
    category TEXT NOT NULL, -- '증권/주식' etc.
    title TEXT NOT NULL,
    snippet TEXT,
    url TEXT UNIQUE,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- hourly_analysis: Analysis results
CREATE TABLE IF NOT EXISTS hourly_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country TEXT NOT NULL,
    sub_category TEXT NOT NULL,
    score INTEGER NOT NULL,
    label TEXT, -- '75점'
    comment TEXT,
    references JSONB, -- list of { title, url, source_type }
    analyzed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_raw_items_category ON raw_items(country, category, published_at);
CREATE INDEX IF NOT EXISTS idx_hourly_analysis_category ON hourly_analysis(country, sub_category, analyzed_at);
