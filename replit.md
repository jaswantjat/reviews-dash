# Eltex Reviews Dashboard

## Overview

Full-stack TV dashboard for Eltex's Q2 2026 Google Reviews tracking. Displays live net score vs 270-review objective, monthly breakdown, live clock, and rotating motivational messages. Reviews are fetched from Google Maps via a cascade of API providers.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS
- **Deployment**: Railway.app (nixpacks)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (backend + prod static serving)
│   └── dashboard/          # React frontend (TV dashboard UI)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── railway.json            # Railway deployment config
├── nixpacks.toml           # Railway build config (install + build + start)
└── pnpm-workspace.yaml
```

## Architecture

### Data Flow
1. **Reviews**: Backend polls HasData → SearchAPI → ScrapingDog (cascade) every 45 min
2. **Cache**: In-memory cache with SSE push — browser clients get live updates instantly when new data arrives
3. **Frontend**: SSE stream for real-time push + React Query polling every 30s as fallback

### Review Provider Notes
- **HasData**: Uses `placeId` (`PLACE_ID_ELTEX` env var). 1,000 calls/month quota.
- **SearchAPI**: Uses `place_id` with `google_maps_reviews` engine (NOT text `q` query). Key: `SEARCHAPI_KEY`.
- **ScrapingDog**: Uses `data_id` directly on `/google_maps/reviews` endpoint (NOT the old 2-step search). Key: `SCRAPING_DOG_API_KEY`, `DATA_ID_ELTEX` = `0x12a4a3e6799a3085:0x9d88aa209e58efe0`.

### API Endpoints
- `GET /api/healthz` — Health check
- `GET /api/dashboard` — Returns cached dashboard data (triggers refresh if stale)
- `POST /api/dashboard/refresh` — Manual data refresh

### Provider Cascade
1. **HasData** (1,000 credits/month) — Primary
2. **SearchAPI** (100 calls/month) — Fallback
3. **ScrapingDog** (one-time 1,000 credits) — Last resort

## Environment Variables / Secrets

| Key | Type | Value |
|-----|------|-------|
| `HASDATA_KEY` | Secret | HasData API key |
| `SCRAPINGDOG_KEY` | Secret | ScrapingDog API key |
| `SEARCHAPI_KEY` | Secret | SearchAPI.io key |
| `ZENDESK_TOKEN` | Secret | Zendesk API token |
| `ZENDESK_SUBDOMAIN` | Env var | `eltex` |
| `ZENDESK_EMAIL` | Env var | `jaswant@eltex.es` |
| `PLACE_ID_ELTEX` | Env var | `ChIJhTCaeeajpBIR4O9YniCqiJ0` |

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

## Railway Deployment

The app is Railway-ready:
- `railway.json` — health check + restart policy
- `nixpacks.toml` — build: dashboard → api-server, start: `node ./artifacts/api-server/dist/index.mjs`
- In production, Express serves React static files from `artifacts/dashboard/dist/public/`
- Required Railway env vars: all secrets above + `PORT` (set automatically by Railway)

## Scoring Logic

- Rating ≥ 4 → +1 (positive)
- Rating ≤ 2 → -1 (negative)
- Rating = 3 → skip
- Net score = positive − negative
- Q2 reviews are filtered by `iso_date` between `2026-04-01` and `2026-06-30`
- Only current-trimester reviews count toward the bonus goal; historical reviews are irrelevant

## Pre-Trimester State

When today < `trimesterStart`, the dashboard enters "countdown mode":
- Gauge center shows days remaining until the trimester starts
- "EMPIEZA EL 1 ABR" label in the gauge
- Left panel badge switches to "X días hasta el inicio de Q2"
- Footer shows `objetivo · Q2 2026 · empieza el 1 ABR`
- Pace calculation uses total trimester days (full 91 days for Q2)

## Production Readiness Notes

- `lib/db` and `lib/api-zod` must be built (`pnpm run build`) before running `tsc --noEmit` on the api-server (project references require declaration files)
- Only two workflows are needed: `artifacts/api-server: API Server` and `artifacts/dashboard: web`
- The "Start application" workflow was removed — it conflicted with the API server workflow on port 8080
- SSE stream sends heartbeat every 15s; client reconnects after 30s on error
- Background polling fetches new reviews every 45 min (configurable via `REVIEWS_POLL_INTERVAL_MS`)
- See `CONTEXT.md` for the core product idea
