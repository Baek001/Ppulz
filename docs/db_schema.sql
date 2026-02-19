-- Enable UUID extension if not enabled
create extension if not exists "uuid-ossp";

-- Table: raw_items (Staging area for ingested content)
create table if not exists public.raw_items (
    id uuid default uuid_generate_v4() primary key,
    source_type text not null check (source_type in ('news', 'bill')),
    country text not null check (country in ('kr', 'us')),
    category text not null, -- '경제/금융', 'SubCategory' etc.
    title text not null,
    snippet text,
    url text,
    published_at timestamp with time zone,
    created_at timestamp with time zone default now()
);

-- Index for quick retrieval by category/country/source
create index if not exists idx_raw_items_lookup 
on public.raw_items(country, category, published_at desc);

-- Table: hourly_analysis (Final scores)
create table if not exists public.hourly_analysis (
    id uuid default uuid_generate_v4() primary key,
    country text not null check (country in ('kr', 'us')),
    big_category text not null,
    sub_category text not null,
    score integer check (score >= 0 and score <= 100), -- 0-100 analysis score
    label text, -- e.g. 'Critical', 'Attention', 'Safe'
    comment text, -- One line summary
    confidence float, -- 0.0 to 1.0
    analyzed_at timestamp with time zone default now()
);

-- Index for retrieving history
create index if not exists idx_hourly_analysis_lookup
on public.hourly_analysis(country, sub_category, analyzed_at desc);

-- RLS Policies (Optional but recommended)
alter table public.raw_items enable row level security;
alter table public.hourly_analysis enable row level security;

-- Allow public read access to hourly_analysis (for dashboard)
create policy "Allow public read access"
on public.hourly_analysis for select
using (true);

-- Allow authenticated (service role/cron) insert
-- Note: In Supabase, Service Role bypasses RLS, so this is mainly if you want to allow authenticated users to read.
