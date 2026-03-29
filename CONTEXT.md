# Eltex Reviews Dashboard — Core Product Decisions

## Why this exists

The dashboard is shown on office screens so the team can see in real time how close they are to the bonus. It motivates employees to deliver excellent service so satisfied customers leave a Google review. The message is simple: great service → happy customer → review → €300 bonus.

## The goal

Each trimester, Eltex sets a target number of positive Google reviews (e.g. 270 for Q2 2026).
If the team reaches that number by the end of the trimester, every manager earns a **€300 bonus**.

## What counts toward the bonus

- Only reviews posted **within the current trimester date range** count toward the goal.
- A **positive** review is a 4 or 5 star Google review.
- A **negative** review is a 1 or 2 star Google review.
- 3-star reviews are neutral and do not affect the score.
- Net score = positive − negative.

## Data source: Google Maps only

We only use **Google Maps reviews**. No other platforms (Trustpilot, Facebook, etc.).

The three scraping providers — HasData, SearchAPI, ScrapingDog — all pull from Google Maps.
They run in cascade: HasData → SearchAPI → ScrapingDog. If all fail, cached data is served.

## Real-time vs. historical data

### Real-time (what matters)

- **Current trimester reviews** (Q2 2026: Apr 1 – Jun 30): scraped live, stored in DB, tracked against the 270-review objective.
- **Recent activity carousel**: the latest real reviews fetched from Google Maps, shown on the TV screen.
- **Google totals**: `googleTotalReviews` and `googleAvgRating` come from the live place info returned by the scraper on each poll. This is what is shown as "reseñas totales" and the star rating on the left panel.

### Historical (numbers only — no full scrape needed)

- For **all-time stats** (total review count, avg rating), we use the aggregate numbers Google returns directly — **we do not need to store every individual historical review**.
- The 498 reviews currently in the DB (covering Nov 2021 → Mar 2026) are sufficient for computing historical positive/negative context. There is no requirement to fetch all 897 Google reviews individually.
- The `place_meta` table stores the live Google aggregate: 897 total, 4.6 avg rating. This is updated on every scraping poll.

## Data map

| What is displayed | Source | Updated |
|---|---|---|
| Q2 2026 positive/negative count | Live scrape → DB | Every 45 min |
| Recent reviews carousel | Live scrape (newest 8) | Every 45 min |
| Google total review count (897) | Live place info from scraper | Every 45 min |
| Google avg rating (4.6) | Live place info from scraper | Every 45 min |
| All-time positive/negative | 498 stored historical reviews | Static (seeded) |

## Google Maps place identifiers

- **Place ID**: `ChIJhTCaeeajpBIR4O9YniCqiJ0`
- **Data ID** (ScrapingDog): `0x12a4a3e6799a3085:0x9d88aa209e58efe0`
- **DB place_id** (internal, base64 of query string): `RWx0ZXggc29sYXIgRXNwYcOxYQ==`

## Supabase database (as of 2026-03-29)

- **Project**: `nvrfoxhwfmierjmkwttt`
- **URL**: `https://nvrfoxhwfmierjmkwttt.supabase.co`
- **Tables**: `reviews` and `place_meta` — both live, RLS enabled with full anon access
- **Current state**: 498 reviews (421 positive, 74 negative, 3 neutral), place_meta shows 897 Google total / 4.6 avg
- **PAT** (`SUPABASE_PAT`): stored as env var

## Provider status (as of 2026-03-29)

| Provider | Status | Quota |
|---|---|---|
| HasData | 403 — rate limited | 1,000 calls/month |
| SearchAPI | 429 — rate limited | 100 calls/month |
| ScrapingDog | 403 after ~100 reviews | One-time credits, partially used |

All providers auto-recover when quotas reset. The dashboard serves cached DB data in the meantime.

## Current trimester

- **Name**: Q2 2026
- **Period**: April 1 – June 30, 2026
- **Objective**: 270 positive reviews
- **Bonus**: €300 per manager

## To update the trimester (Q3, Q4, etc.)

Edit `artifacts/api-server/src/config.ts`:

```typescript
trimester: {
  name: "Q3 2026",
  startDate: "2026-07-01",
  endDate: "2026-09-30",
  objective: 270,
  months: ["July", "August", "September"],
}
```
