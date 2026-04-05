# Eltex Reviews Dashboard

---

> **AGENT SELF-REMINDER — READ BEFORE EVERY SESSION**
> Always update this file when you make architectural changes, fix bugs, change behaviour, or add features.
> Keep the "Recent changes" section current. Keep numbers, dates, and states accurate.
> This file is your memory. If it's stale, your context is stale.

---

## Overview

Full-stack TV dashboard for Eltex's Q2 2026 Google Reviews tracking. Displays live net score vs 270-review objective, monthly breakdown, live clock, rotating review cards, and a PRE_Q2 countdown gauge. Reviews are fetched from Google Maps via a cascade of scraping API providers and stored in Supabase.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: Supabase (PostgreSQL via REST/JS client, not direct Postgres connection)
- **ORM**: Drizzle ORM (schema only — DB writes go through Supabase JS client)
- **Build**: esbuild (ESM bundle)
- **Frontend**: React + Vite (single file: `artifacts/dashboard/src/App.tsx`, 959 lines)
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
1. **Poll**: Backend polls SearchAPI → Apify (cascade) once daily at 06:00 UTC via `startPolling()` in `poller.ts`
2. **Store**: New reviews upserted into Supabase `reviews` table via `upsertReviews()`; place info into `place_meta` via `upsertPlaceMeta()`
3. **Cache + broadcast**: `setReviewsCache(data)` updates in-memory cache and calls `broadcast()` which pushes to all connected SSE clients via a `Set<DashboardListener>` pub/sub
4. **Serve**: SSE stream (`/api/dashboard/stream`) sends current snapshot on connect, then pushes updates as they arrive. REST (`/api/dashboard`) returns cached snapshot for fast first paint and SSE fallback
5. **Fallback**: If all providers fail, cached DB data is served. If DB is empty, hardcoded baseline snapshot is used.

### SSE / Heartbeat
- **Heartbeat interval**: 45 minutes (changed from 15 s on 2026-03-30) — just a TCP keep-alive ping
- **Heartbeat event type**: `"heartbeat"` — client does NOT listen for this; it is silently ignored by the browser
- **Data push event type**: `"dashboard"` — client listens via `es.addEventListener("dashboard", ...)`
- **Retry hint**: `retry: 10000` — browser auto-reconnects in 10 s if connection drops
- **Manual reconnect**: `es.onerror` → closes ES → REST poll → retry SSE after 30 s

### Review Slider
- Rotates through 8 most recent reviews every **14 seconds**
- CSS animations: `revIn` (slide up, 0.6 s) / `revOut` (slide down, 0.32 s) via `.r-in` / `.r-out` classes
- Dot indicators below the card are clickable and keyboard-navigable
- `stripHtml()` cleans `<br>` and HTML entities before display
- Content updates automatically when SSE pushes new data (React re-renders `currentReview = reviewList[revIdx]`)

### Gauge (RadialGauge component)
- **Pure SVG semicircle** — no Recharts dependency (Recharts was removed 2026-03-30)
- PRE_Q2 mode (`dimmed=true`): full muted indigo ring, no progress fill, shows days until start
- Active mode: indigo progress arc from left to right, proportional to `netScore / objective`
- SVG arc math: `M cx-R cy A R R 0 0 1 cx+R cy` for track; endpoint computed via `cos/sin` for progress

### Key product decisions
- **Google Maps reviews only** — no other platforms
- **Real-time for current trimester**: Q2 2026 reviews are scraped live and count toward the 270-review goal
- **Historical data = numbers only**: `googleTotalReviews` (898) and `googleAvgRating` (4.6) from `place_meta` are the authoritative left-panel stats. The 976 stored reviews provide historical positive/negative context for ratio scaling.

### Scoring logic
- Rating ≥ 4 → positive (+1)
- Rating ≤ 2 → negative (−1)
- Rating = 3 → neutral (skip)
- Net score = positive − negative
- Only reviews with `iso_date` between `trimesterStart` and `trimesterEnd` count

## Supabase (live as of 2026-03-30)

- **Project ID**: `nvrfoxhwfmierjmkwttt`
- **URL**: `https://nvrfoxhwfmierjmkwttt.supabase.co`
- **Publishable key**: `sb_publishable_cdPsgk5Rtz4y98BQ0ubniQ_QywlLeMZ`
- **Service role key**: in `lib/db/src/supabase.ts`
- **PAT**: stored as `SUPABASE_PAT` env var
- **Tables**: `reviews` (**976 rows** stored as of 2026-03-30) + `place_meta` (1 row: 898 Google-reported total / 4.6 avg)

### Numbers — First-Principles Breakdown (verified live 2026-03-30)

**Raw Supabase (`reviews` table):**

| Rating | Count | Category |
|--------|-------|----------|
| ★★★★★ (5) | 847 | POSITIVE |
| ★★★★ (4) | 15 | POSITIVE |
| ★★★ (3) | 5 | NEUTRAL |
| ★★ (2) | 10 | NEGATIVE |
| ★ (1) | 99 | NEGATIVE |
| **Total stored** | **976** | — |

Breakdown:
- **4–5★ Positive: 847 + 15 = 862**
- **1–2★ Negative: 10 + 99 = 109**
- **3★ Neutral: 5**
- **862 + 109 + 5 = 976 ✓**

`place_meta` table: `google_total_reviews = 898`, `google_avg_rating = 4.6` (last updated 2026-03-30)

**Why 976 stored vs 898 on Google?** Our scrapers collected 78 reviews that Google no longer shows (removed/de-indexed). Google's 898 is the public-facing authoritative total.

**Dashboard display logic (App.tsx) — verified 2026-03-30:**
- `reseñas totales` → `googleTotalReviews` = **898** (from `place_meta`)
- `Positivas` → `round(898 × 862 / 971)` = `round(797.4)` = **797** (animated via `useCountUp(797, 2000)`)
- `Negativas` → `898 − 797` = **101** (animated via `useCountUp(101, 2000)`)
- **Check: 797 + 101 = 898 ✓**
- All three counters (`cntTotal`, `cntPos`, `cntNeg`) now animate together on page load

- **RLS**: enabled, anon key has full read/write access (non-sensitive data)
- **Setup SQL**: `supabase-setup.sql` (already applied)
- **Keep-alive**: Supabase pinged every 12 hours via `startKeepAlive()` to prevent free-tier project pause

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/healthz` | Health check |
| GET | `/api/dashboard` | Cached dashboard data (JSON) |
| GET | `/api/dashboard/stream` | SSE real-time stream |
| POST | `/api/dashboard/refresh` | Manual provider refresh |
| POST | `/api/dashboard/seed` | Full historical seed (50 pages, all providers) |
| POST | `/api/dashboard/push-to-supabase` | Sync local DB reviews → Supabase |

## Provider Cascade

| Priority | Label | Provider | Quota | Key env var |
|----------|-------|----------|-------|-------------|
| 1 | `searchapi-key1` | SearchAPI primary | 100 calls/month | `SEARCHAPI_KEY` |
| 2 | `searchapi-key2` | SearchAPI backup  | 100 calls/month | `SEARCHAPI_KEY_BACKUP` |
| 3 | `apify-key1`     | Apify primary     | Pay-per-use | `APIFY_API_KEY` |
| 4 | `apify-key2`     | Apify backup      | Pay-per-use | `APIFY_API_KEY_BACKUP` |

Place identifier: `PLACE_ID_ELTEX` = `ChIJhTCaeeajpBIR4O9YniCqiJ0` (hardcoded fallback in `reviews.ts`)

**Status as of 2026-03-30**: All 4 keys stored as Replit env vars. No hardcoded fallbacks in code. Cascade auto-skips any key that returns 429/403.

## Environment Variables

| Key | Where set | Value |
|-----|-----------|-------|
| `SUPABASE_PAT` | Replit env var | Supabase Personal Access Token |
| `SEARCHAPI_KEY` | Replit env var | Primary SearchAPI key |
| `SEARCHAPI_KEY_BACKUP` | Replit env var | Backup SearchAPI key |
| `APIFY_API_KEY` | Replit env var | Primary Apify key |
| `APIFY_API_KEY_BACKUP` | Replit env var | Backup Apify key |
| `PLACE_ID_ELTEX` | Hardcoded fallback in services/reviews.ts | `ChIJhTCaeeajpBIR4O9YniCqiJ0` |
| `POLL_HOUR_UTC` | Railway env var (optional) | Hour (0–23) to run daily poll; default `6` (06:00 UTC) |

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

## Pre-Trimester Countdown Mode (PRE_Q2)

Activated when `new Date() < new Date(trimesterStart)`.

Dashboard shows:
- Gauge center: days until trimester starts (currently 2 days, as of 2026-03-30)
- Gauge ring: muted indigo, no progress fill
- Center badge: "NO INICIADO"
- Left badge: "X días hasta el inicio de Q2"
- Progress bar: locked at 0%
- Pace: calculated over full trimester duration (270 / 13 weeks = 21/week)
- Label: "Objetivo Q2 2026: 0 / 270"
- Note: "El marcador se activará el 1 ABR"

## Railway Deployment

- `railway.json` — builder: Railpack, health check at `/api/healthz`, restart on failure
- **Build**: Railpack auto-detects pnpm from `pnpm-lock.yaml` + runs the `build` script from root `package.json` (typecheck → dashboard → api-server)
- **Start**: `node --enable-source-maps ./artifacts/api-server/dist/index.mjs` (set in `railway.json`)
- Express serves React static files from `artifacts/dashboard/dist/public/` in production
- `.env.example` — Railway auto-suggests these variables for import when you connect the repo
- Required env vars: `PORT` (auto-set by Railway), `SEARCHAPI_KEY`, `APIFY_API_KEY`, `SUPABASE_PAT`, optionally `POLL_HOUR_UTC`

## gstack QA Tool

Installed at `.claude/skills/gstack/`. Binary: `.claude/skills/gstack/browse/dist/browse`.

**IMPORTANT**: The headless Chromium browser used by the gstack `/qa` skill **cannot run in Replit** due to missing kernel sandboxing (`No usable sandbox!` — Replit blocks unprivileged user namespaces). Use these alternatives instead:
- `screenshot` tool — visual audit of any URL
- `curl` — API/SSE endpoint testing
- `refresh_all_logs` — browser console errors and workflow logs
- Code inspection — direct `App.tsx` audit

Skills loaded: `/qa`, `/qa-only`, `/investigate`, `/review`. Version: 0.13.3.0 (0.14.0.0 available).

## Recent Changes

### 2026-04-05 — Progress bar stuck at 0% — fixed

**Bug fixed — both progress bars showing empty (0%) despite netScore > 0:**
- Root cause: `pct = Math.round(1/270*100) = Math.round(0.37) = 0` → bar width was "0%"
- Fix: split `pct` into three variables in App.tsx:
  - `pctRaw` (float): raw decimal percentage, used for accurate calculations
  - `pctBar` = `PROGRESS > 0 ? Math.max(pctRaw, 3) : 0` → bar always shows minimum 3% fill when any progress exists
  - `pctLabel` = `"<1%"` when pct rounds to 0 but progress exists, else `"${pct}%"`
- Both left-panel and footer progress bars now use `pctBar`
- Footer percentage label now shows `"<1%"` instead of `"0%"`

**Workflow port fixed:**
- artifact.toml specifies `localPort = 5000` but workflow was running on PORT=3000 — mismatch
- Fixed: workflow now runs with `PORT=5000` matching the artifact

**Note on Positivas/Negativas/Total numbers:**
- These are ALL-TIME scaled stats (not Q2-specific). They appear frozen because with only 1-2 new Q2 reviews, the rounding doesn't change the displayed value (still 797/101/898). This is correct by design per the scoring logic in replit.md.

### 2026-03-30 — Railway production deployment fixed & live

**Bug fixed — frontend "not found" on Railway:**
- `app.ts` was resolving the static files path with 3 `..` levels instead of 2
- Old (broken): `path.resolve(__dirname, "..", "..", "..", "dashboard", "dist", "public")` → `/app/dashboard/dist/public` (wrong)
- Fixed: `path.resolve(__dirname, "..", "..", "dashboard", "dist", "public")` → `/app/artifacts/dashboard/dist/public` (correct)
- Deployed via Railway CLI (`railway up --service reviews-dash`)
- All endpoints verified live: `/` → 200, `/api/healthz` → 200, `/api/dashboard` → 200

**Production URL**: https://reviews-dash-production.up.railway.app

**Credentials stored**:
- `RAILWAY_TOKEN` — Railway project token (project: Review dashboard, env: production)
- `GITHUB_TOKEN` — GitHub PAT for `jaswantjat/reviews-dash`

**Railway env vars set (via CLI)**:
- `SEARCHAPI_KEY`, `SEARCHAPI_KEY_BACKUP`, `APIFY_API_KEY`, `APIFY_API_KEY_BACKUP` — polling cascade
- `SUPABASE_PAT` — Supabase management API
- `POLL_HOUR_UTC` — daily poll hour
- `NODE_ENV=production` — enables static file serving

**Final first-principles audit (2026-03-30):**
- `GET /` → 200 ✅ (frontend loads)
- `GET /api/healthz` → 200 ✅
- `GET /api/dashboard` → 200 ✅ (all numbers match: 898 total, 4.6 avg, 862 pos, 109 neg, 976 stored)
- SSE stream → fires `event:dashboard` immediately on connect ✅
- PRE_Q2 mode correct (Q2 starts 2026-04-01, netScore=0) ✅
- Daily polling scheduled for 06:00 UTC with all 4 cascade keys ✅

**Note on GitHub push**: Replit restricts direct `git push` from the main agent. To keep Railway in sync with GitHub, push manually or use `railway up` from Replit when changes are made.

### 2026-03-30 — Daily poll schedule + Railway prep

**Polling changed from every 45 min → once daily at 06:00 UTC:**
- `startPolling()` in `poller.ts` now uses `setTimeout` + reschedule (not `setInterval`) to fire at the next 06:00 UTC wall-clock time, then every 24 h thereafter
- `CONFIG.polling.reviewsIntervalMs` removed; replaced with `CONFIG.polling.pollHourUtc` (default `6`, overrideable via `POLL_HOUR_UTC` env var on Railway)
- `isReviewCacheStale()` in `cache.ts` threshold updated from the old interval to 24 h

**Railway deployment updated for Railpack:**
- Railway migrated from Nixpacks → Railpack; updated `railway.json` builder field to `RAILPACK`
- Deleted `nixpacks.toml` — Railpack auto-detects pnpm and the monorepo from `pnpm-lock.yaml` / `pnpm-workspace.yaml`
- Created `.env.example` — Railway scans this and offers one-click variable import when you connect the repo; includes `SEARCHAPI_KEY`, `APIFY_API_KEY`, `SUPABASE_PAT`, and `POLL_HOUR_UTC`

### 2026-03-30 — Full QA audit + bug fixes

**Gauge — replaced Recharts with pure SVG:**
- Removed `ResponsiveContainer` + `RadialBarChart` (were causing `ResponsiveContainer is not defined` runtime error)
- Replaced with custom SVG semicircle: track path + conditional progress arc, computed via `cos/sin`
- No Recharts dependency remains in `App.tsx`

**Bug fix — Negative counter not animated:**
- `NEGATIVAS` StatChip was receiving raw `NEGATIVE` number (jumped instantly to 101)
- `POSITIVAS` and total both used `useCountUp` and animated smoothly
- Fix: added `const cntNeg = useCountUp(NEGATIVE, 2000)` and wired it to the chip
- All three stats (total, positivas, negativas) now count up together on page load

**SSE heartbeat interval:**
- Changed from 15 seconds → 45 minutes (matches polling interval)
- Heartbeat is a passive TCP keep-alive; actual data pushes are instant via `broadcast()` pub/sub
- Browser auto-reconnects in 10 s if connection drops (`retry: 10000`)

**QA audit results (2026-03-30):**
- All 13 API fields present ✓
- All data sanity checks pass ✓
- Zero console errors in current state ✓
- SSE sends on connect + heartbeat every 45 min + instant push on new reviews ✓
- Review slider rotates every 14 s, CSS animations intact ✓
- Supabase write flow verified: poll → upsert reviews + place_meta → broadcast → SSE push ✓

### 2026-03-29 — UX review + bug fixes

**UI improvements (customer support feedback):**
- Review carousel slowed from 6 s → 14 s per card so agents can read comfortably
- Review text clamped to 6 lines (`-webkit-line-clamp: 6`) to prevent layout breaks on long reviews; HTML in raw review text is stripped client-side via `stripHtml()` in `App.tsx`
- "Ritmo necesario" now has a subtext: "para alcanzar el objetivo del trimestre"
- Pre-trimester gauge state ("NO INICIADO") is now unambiguous:
  - Badge next to gauge label
  - Dashed note inside gauge: "El marcador se activará el 1 ABR"
- Both positive and negative reviews rotate in the carousel (no filtering — `recentActivity` from the API includes all ratings)

**TypeScript / build fixes:**
- `lib/db` package had a **stale build** — `dist/supabase.d.ts` was missing `supabaseAdmin`, `pushReviewsToSupabase`, `pushPlaceMetaToSupabase`. Fixed by running `pnpm run build` in `lib/db`. **Always rebuild `lib/db` after touching `lib/db/src/supabase.ts`.**
- `HARDCODED_DASHBOARD` fallback was missing `openTickets: 0` and `oldestTicketDays: 0` required by `DashboardCache` type
- After rebuild: `npx tsc --noEmit` passes cleanly for both dashboard and api-server (EXIT:0)

## AI Coding Workflow

Embedded from https://github.com/nathnotifia/ai-coding-workflow into `.agents/skills/ai-coding-workflow/`.

An isolated-agent workflow for PRD/EPIC planning and GitHub issue implementation. Two top-level commands:

- **`prd`** — Turn a vague idea into a decision-complete PRD/EPIC using `prd-epic-workflow` + `requirements-clarity` (clarity score must reach ≥ 90/100), then decompose into child TASKs via `epic-decompose`.
- **`impl`** — Orchestrate implementation of a GitHub issue via `gh-issue-orchestrator` → Dev sub-agent → QA sub-agent (merge gate, loops until PASS) → Merge sub-agent.

Sub-skills stored at `.agents/skills/ai-coding-workflow/skills/`:
- `prd-epic-workflow`, `requirements-clarity`, `epic-decompose`
- `gh-issue-orchestrator`, `gh-issue-dev`, `gh-issue-qa`, `gh-issue-merge`
- `agent-learnings` — log durable learnings as JSON to `.agents/skills/ai-coding-workflow/skills/agent-learnings/entries/`

Key invariants: EPICs never closed by PRs. Every TASK body starts with `Epic: #<N>`. Every EPIC has a final `Execution: run end-to-end + post evidence` TASK. QA must PASS before Merge launches.

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
