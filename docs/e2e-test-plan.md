# End-to-End Test Plan — Eltex Reviews Dashboard

## 1. API Server

### 1.1 REST Dashboard Endpoint
- `GET /api/dashboard` → 200 JSON, all fields present
- Fields to verify: `netScore`, `positive`, `negative`, `objective`, `googleAvgRating`, `googleTotalReviews`, `allTimePositive`, `allTimeNegative`, `allTimeTotal`, `trimesterName`, `trimesterStart`, `trimesterEnd`, `recentActivity`, `provider`, `updatedAt`
- Second call → `cacheHit: true`

### 1.2 SSE Stream
- `GET /api/dashboard/stream` → `Content-Type: text/event-stream`
- Receives `event: dashboard` within 2 s of connect
- Receives `event: heartbeat` every 15 s
- On browser tab close, server cleans up the subscription (no orphaned intervals)

### 1.3 Manual Refresh
- `POST /api/dashboard/refresh` → 200 `{ success: true }`
- Cache is invalidated; next `GET /api/dashboard` returns `cacheHit: false`
- SSE clients receive a new `dashboard` push after refresh

### 1.4 Error Handling
- Kill the API server → `GET /api/dashboard` returns 503 or connection refused (not a 200 with bad data)
- Restart API → dashboard auto-reconnects via SSE retry

---

## 2. Frontend Dashboard UI

### 2.1 Initial Load
- Page renders without JavaScript errors in the browser console
- Loading spinner appears while waiting for first API response
- UI populates within 2 s on a local connection

### 2.2 Live Data Binding
| UI Element | API Field | Expected |
|---|---|---|
| Rating number | `googleAvgRating` | e.g. 4.6 |
| Star rating | `googleAvgRating` rounded | 5 filled stars for 4.6 |
| Total reviews counter | `googleTotalReviews` | animated count-up to real number |
| Positivas chip | `allTimePositive` | animated count-up |
| Negativas chip | `allTimeNegative` | static integer |
| Arc gauge value | `netScore` | Q2 net positive count |
| Arc gauge total | `objective` | 270 |
| Center counter | `netScore` | same as gauge value |
| "de X objetivo" | `objective` | 270 |
| "Faltan X reseñas" | `objective - netScore` | correct remainder |
| Quarter badge | `trimesterName` | "Q2 2026" |
| Quarter range | `trimesterStart/End` | "ABR – JUN 2026" |
| Days remaining | `trimesterEnd` | correct days from today |
| Pace (reviews/day) | computed | `(objective - netScore) / daysRemaining` |
| Progress bar | `netScore / objective` | correct fill width |
| Footer progress | same | matches left-panel bar |
| Footer % | same | rounds correctly |
| Review carousel | `recentActivity` | real review text + author names |

### 2.3 Clock
- Shows current local time updating every second
- Day/date/month/year display is correct in Spanish abbreviations

### 2.4 Review Carousel
- Reviews cycle every 9 s
- Fade-out / fade-in animation plays smoothly
- Dot indicators advance to match current review index
- Avatar initials match author name
- Avatar color is stable per author (deterministic hash)
- Star rating matches review `rating` field
- Relative time ("hace X días") is computed from `isoDate`
- "En vivo" pulsing green dot is visible

### 2.5 Motivational Banner
- Rotates through all 6 messages every 9 s
- Fade animation plays on each transition

### 2.6 Animations
- Count-up animation runs on first load for total reviews and positives
- Arc gauge tip animates from start position to current fill
- Progress bars animate from 0% to current fill on load

### 2.7 Vite Proxy
- Browser requests to `/api/dashboard` are proxied to port 8080 with no CORS errors
- SSE stream stays connected through the Vite proxy

---

## 3. Real-Time Updates (SSE Push)

- Connect browser to dashboard
- Trigger `POST /api/dashboard/refresh`
- Dashboard UI updates in place without a page reload
- All live-data fields reflect the new values
- No duplicate SSE subscriptions on reconnect

---

## 4. Background Polling

- Poll interval is 45 min (`REVIEWS_POLL_INTERVAL_MS=2700000`)
- After a poll, `updatedAt` timestamp advances
- If an external provider call fails, the server falls back to the next provider in the cascade (SearchAPI → Apify)
- Failed provider does not crash the poller; next scheduled poll still fires

---

## 5. Database Integrity

```sql
-- Total rows
SELECT COUNT(*) FROM reviews;

-- All reviews belong to one place
SELECT DISTINCT place_id FROM reviews;

-- Rating distribution
SELECT rating, COUNT(*) FROM reviews GROUP BY rating ORDER BY rating;

-- Most recent review date
SELECT MAX(iso_date) FROM reviews;

-- Q2 2026 reviews (should be 0 until April 1)
SELECT COUNT(*) FROM reviews
WHERE iso_date >= '2026-04-01' AND iso_date < '2026-07-01' AND rating >= 4;

-- Place meta
SELECT * FROM place_meta;
```

---

## 6. Edge Cases

| Scenario | Expected Behaviour |
|---|---|
| `netScore = 0` (Q2 not started) | Arc gauge shows empty ring; center shows "0"; pace/days compute correctly |
| `netScore = objective` | Arc fills completely; green "¡Objetivo alcanzado!" message; arc glows |
| `recentActivity` all have empty `text` | Review card falls back to "Cliente de Eltex Solar." |
| API server down on first load | Error screen shown; retries every 30 s via REST poll |
| SSE drops mid-session | Client reconnects automatically via SSE `retry: 10000` and `onerror` handler |
| `daysRemaining = 0` | Pace shows 0, days badge shows "0 días restantes" |

---

## 7. Cross-Browser / Display

- Renders at 1920×1080 (TV) without scrollbars
- Renders at 1280×720 without layout overflow
- No horizontal scroll at any supported resolution
- Logo loads from external CDN URL
- Google "G" SVG icon renders in review cards and left-panel header

---

## 8. Security / Hardening

- API keys are in environment variables, not hard-coded in committed source
- `ACCESS-CONTROL-ALLOW-ORIGIN: *` is acceptable for a read-only internal dashboard
- No user-supplied input is rendered as raw HTML (XSS surface)
- SSE endpoint does not expose raw DB credentials or internal stack traces

---

## 9. Run Order

1. Start API server (`Start application` workflow, port 8080)
2. Start dashboard (`artifacts/dashboard: web` workflow)
3. Run DB integrity queries (section 5)
4. Hit all REST endpoints (section 1)
5. Open dashboard in browser, verify initial load (section 2.1–2.6)
6. Trigger manual refresh, watch SSE push (section 3)
7. Simulate API downtime, verify fallback (section 6)
8. Confirm at TV resolution (section 7)
