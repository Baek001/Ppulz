# Mock Data Mode

This project supports a "Mock Data Mode" to allow frontend development and verification without relying on external APIs (OpenAI) or database population.

## Improving Stability
Since the OpenAI analysis API can be unstable or costly during high-frequency dev cycles, this mode generates **deterministic random data** based on the user ID and subcategory. This ensures that:
- Refreshes don't change the data (stable visual testing).
- Tabs show different, consistent graphs.
- No external API calls are made.

## How to Enable
1.  Open `.env.local`.
2.  Set `USE_MOCK_ANALYSIS=true`.
3.  Restart the server (`npm run dev`).

## How to Disable (Real Mode)
1.  Open `.env.local`.
2.  Set `USE_MOCK_ANALYSIS=false` (or remove the line).
3.  Restart the server.

## Data Logic
-   **Source**: `src/lib/mock/generator.js`
-   **Points**: Returns 3 data points (Now-2h, Now-1h, Now).
-   **Seed**: `userId + subCategory` string is used to seed a PRNG (Pseudo-Random Number Generator), ensuring the same sequence of numbers every time for that combination.
