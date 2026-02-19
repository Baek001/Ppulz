# PPulse Dashboard Runbook

This guide explains how to set up, run, and maintain the PPulse Dashboard and its data pipeline.

## 1. Environment Setup

Copy `.env.local` and ensure the following keys are set:

```env
# Database (Supabase)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# AI Analysis
OPENAI_API_KEY=sk-...

# Data Sources (Optional for MVP, but needed for real data)
DATA_GO_KR_API_KEY=...  # for Korea Bills (data.go.kr)
CONGRESS_GOV_API_KEY=... # for US Bills (api.congress.gov)
```

## 2. Database Setup

1.  Go to your Supabase Project > SQL Editor.
2.  Open `docs/db_schema.sql` from this project.
3.  Copy and Paste the SQL content into the editor and clicking **Run**.
    - This creates `raw_items` and `hourly_analysis` tables.

## 3. Data Pipeline (Cron Jobs)

The dashboard relies on periodic data ingestion and analysis.

### Manual Trigger (for Testing)
You can trigger these endpoints via browser or `curl` to test data flow:

1.  **Ingest Data** (Collects News/Bills):
    - GET `http://localhost:3000/api/cron/ingest`
    - *Note: This fetches Google News RSS for the subcategories of onboarded users.*

2.  **Analyze Data** (Generates Scores):
    - GET `http://localhost:3000/api/cron/analyze`
    - *Note: Uses OpenAI to analyze recent items and saves scores to `hourly_analysis`.*

### Production Setup (Vercel Cron)
To run this automatically in production, add a `vercel.json` configuration:

```json
{
  "crons": [
    {
      "path": "/api/cron/ingest",
      "schedule": "*/10 * * * *"
    },
    {
      "path": "/api/cron/analyze",
      "schedule": "0 * * * *"
    }
  ]
}
```

## 4. Verification

1.  **Log In**: Ensure you are logged in and have completed onboarding (selected subcategories).
2.  **Populate Data**: Visit `/api/cron/ingest` then `/api/cron/analyze`.
3.  **View Dashboard**: Go to `/dashboard`.
    - You should see tabs for your selected subcategories.
    - Toggle between **KR** and **US**.
    - View the Score Graph and current Score Card.

## 5. Troubleshooting

-   **Graph is empty**: Check if `hourly_analysis` table has data for the selected `sub_category` and `country`.
-   **Analysis fails**: Check `OPENAI_API_KEY`.
-   **News not fetching**: Check console logs in `/api/cron/ingest` output. Google News RSS structure might have changed.
