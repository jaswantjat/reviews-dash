# Eltex Reviews Dashboard

## Overview

Full-stack TV dashboard for Eltex's Q2 2026 Google Reviews tracking. Displays live net score vs 270-review objective, monthly breakdown, live clock, and rotating motivational messages. Reviews are fetched from Google Maps via a cascade of scraping API providers and stored in Supabase.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: Supabase (PostgreSQL via REST/JS client, not direct Postgres connection)
- **ORM**: Drizzle ORM (schema only — DB writes go through Supabase JS client)
- **Build**: esbuild (ESM bundle)
- **Frontend**: React + Vite
- **Deployment**: Railway.app (nixpacks)

## Structure

```text
/
├── artifacts/
│   ├── api-server/         # Express API + polling + SSE stream
│   └── dashboard/          # React frontend (TV dashboard UI)
├── lib/
│   └── db/                 # Supabase client + schema types
├── CONTEXT.md              # Product decisions and data source rules
├── supabase-setup.sql      # DDL + RLS policies for Supabase
├── railway.json            # Railway deployment config
└── pnpm-workspace.yaml
```

## Architecture

### Data Flow
1. **Poll**: Backend polls HasData → SearchAPI → ScrapingDog (cascade) every 45 min
2. **Store**: New reviews upserted into Supabase (`reviews` table), place info into `place_meta`
3. **Serve**: SSE stream pushes live data to browser clients; REST fallback polls every 30 s
4. **Fallback**: If all providers fail, cached DB data is served. If DB is empty, hardcoded baseline snapshot is used.

### Key product decisions
- **Google Maps reviews only** — no other platforms
- **Real-time for current trimester**: Q2 2026 reviews are scraped live and count toward the 270-review goal
- **Historical data = numbers only**: we do not need all 897 historical reviews stored individually. The `googleTotalReviews` (897) and `googleAvgRating` (4.6) from `place_meta` are the source of truth for the left-panel stats. The 498 stored reviews provide historical positive/negative context.

### Scoring logic
- Rating ≥ 4 → positive (+1)
- Rating ≤ 2 → negative (−1)
- Rating = 3 → neutral (skip)
- Net score = positive − negative
- Only reviews with `iso_date` between `trimesterStart` and `trimesterEnd` count

## Supabase (live as of 2026-03-29)

- **Project ID**: `nvrfoxhwfmierjmkwttt`
- **URL**: `https://nvrfoxhwfmierjmkwttt.supabase.co`
- **Publishable key**: `sb_publishable_cdPsgk5Rtz4y98BQ0ubniQ_QywlLeMZ`
- **Service role key**: in `lib/db/src/supabase.ts`
- **PAT**: stored as `SUPABASE_PAT` env var
- **Tables**: `reviews` (**975 rows** stored as of 2026-03-29) + `place_meta` (1 row: 897 Google-reported total / 4.6 avg)

### Numbers — First-Principles Breakdown (verified live from Supabase 2026-03-29)

**Raw Supabase query results (direct DB, no transformations):**

| Rating | Count | Category |
|--------|-------|----------|
| ★★★★★ (5) | 847 | POSITIVE |
| ★★★★ (4) | 15 | POSITIVE |
| ★★★ (3) | 5 | NEUTRAL |
| ★★ (2) | 10 | NEGATIVE |
| ★ (1) | 98 | NEGATIVE |
| **Total stored** | **975** | — |

Breakdown:
- **4–5★ Positive: 847 + 15 = 862**
- **1–2★ Negative: 10 + 98 = 108**
- **3★ Neutral: 5**
- **862 + 108 + 5 = 975 ✓**

`place_meta` table: `google_total_reviews = 897`, `google_avg_rating = 4.6` (last updated 2026-03-29)

**Why 975 stored vs 897 on Google?** Our scrapers collected 78 reviews that Google no longer shows (removed/de-indexed). Google's 897 is the public-facing authoritative total.

**Dashboard display logic (App.tsx) — verified:**
- `reseñas totales` → `googleTotalReviews` = **897**
- `Positivas` → `round(897 × 862 / (862+108))` = `round(897 × 862 / 970)` = `round(797.12)` = **797**
- `Negativas` → `897 − 797` = **100**
- **Check: 797 + 100 = 897 ✓**
- Ratio: raw 862:108 = 7.98:1 → scaled 797:100 = 7.97:1 (preserved to 3 sig figs)
- The 5 neutral reviews (~0.5% of total) are absorbed into the proportional rounding — no neutral category is shown on the dashboard

- **RLS**: enabled, anon key has full read/write access (non-sensitive data)
- **Setup SQL**: `supabase-setup.sql` (already applied)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/healthz` | Health check |
| GET | `/api/dashboard` | Cached dashboard data |
| GET | `/api/dashboard/stream` | SSE real-time stream |
| POST | `/api/dashboard/refresh` | Manual provider refresh |
| POST | `/api/dashboard/seed` | Full historical seed (50 pages, all providers) |
| POST | `/api/dashboard/push-to-supabase` | Sync local DB reviews → Supabase |

## Provider Cascade

| Provider | Quota | Key env var | Place identifier |
|----------|-------|-------------|-----------------|
| HasData | 1,000 calls/month | `HASDATA_API_KEY` | `PLACE_ID_ELTEX` = `ChIJhTCaeeajpBIR4O9YniCqiJ0` |
| SearchAPI | 100 calls/month | `SEARCHAPI_KEY` | same place_id |
| ScrapingDog | One-time credits | `SCRAPING_DOG_API_KEY` | `DATA_ID_ELTEX` = `0x12a4a3e6799a3085:0x9d88aa209e58efe0` |

**Status as of 2026-03-29**: HasData is rate-limited (old key). SearchAPI (new key) and ScrapingDog (new key) are active and working.

## Environment Variables

| Key | Where set | Value |
|-----|-----------|-------|
| `SUPABASE_PAT` | Replit env var | Supabase Personal Access Token |
| `HASDATA_API_KEY` | Hardcoded fallback in config.ts | `c7d8134a-3e82-45db-b8d4-ed252eec9261` |
| `SCRAPING_DOG_API_KEY` | Replit env var + hardcoded fallback in config.ts | `69c93a0dc12e078c544a57d8` |
| `SEARCHAPI_KEY` | Replit env var + hardcoded fallback in config.ts | `2BcSHdpwMRps8xR611yFUaPW` |
| `PLACE_ID_ELTEX` | Hardcoded fallback in services/reviews.ts | `ChIJhTCaeeajpBIR4O9YniCqiJ0` |
| `DATA_ID_ELTEX` | Hardcoded fallback in services/reviews.ts | `0x12a4a3e6799a3085:0x9d88aa209e58efe0` |

## Trimester Config

Edit `artifacts/api-server/src/config.ts` to update for Q3/Q4:
```typescript
trimester: {
  name: "Q3 2026",
  startDate: "2026-07-01",
  endDate: "2026-09-30",
  objective: 270,
  months: ["July", "August", "September"],
}
```

## Pre-Trimester Countdown Mode

When today < `trimesterStart`, the dashboard shows a countdown:
- Gauge center: days until trimester starts
- Left badge: "X días hasta el inicio de Q2"
- Pace: calculated over the full trimester length

## Railway Deployment

- `railway.json` — health check + restart policy
- `nixpacks.toml` — build: dashboard → api-server; start: `node ./artifacts/api-server/dist/index.mjs`
- Express serves React static files from `artifacts/dashboard/dist/public/` in production
- Required env vars: `PORT` (auto-set by Railway) + all keys above

## Keep-alive

A background job pings Supabase every 12 hours to prevent the free-tier project from pausing due to inactivity.

## UI/UX Skills

The following UI/UX skills from the `ui-ux-pro-max-skill` repository are embedded in `.agents/skills/`:

- **ui-ux-pro-max** — Master design guide: 50+ styles, 161 palettes, 57 font pairings, 99 UX guidelines, 25 chart types
- **design-system** — Token architecture, component specs, semantic color system
- **ui-styling** — shadcn/ui, Tailwind, component patterns, dark mode
- **design** — Brand identity, logo generation, corporate identity program
- **brand** — Brand voice, visual identity, messaging frameworks

Applied to the dashboard per skill priority order:
1. Accessibility: `lang="es"`, skip link, `aria-label` on all interactive elements, `aria-hidden` on decorative dots, `aria-live` on score display, landmark roles on `<header>`, `<main>`, `<aside>`, `<footer>`, keyboard-navigable review dots with `role="tab"`
2. Touch: Review dots are now clickable/keyboard-operable with `cursor: pointer`
3. Performance: Inter font preload, removed `maximum-scale=1` (viewport zoom lock)
4. Animation: `prefers-reduced-motion` media query disables all animations for users who prefer it
5. Typography: Removed non-standard `fontWeight: 420/450` → standard `400/500`
6. Focus: Visible focus rings via `:focus-visible` CSS rules
