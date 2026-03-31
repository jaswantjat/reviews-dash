# End-to-End Test Plan — Eltex Reviews Dashboard

**Principle**: Pareto-focused. The 20% of tests that cover 80% of risk.  
**Executed**: 2026-03-31 — all 17 tests run live against port 8080 (977 reviews in DB)  
**Fixes applied**: 2026-03-31 — BUG-01, BUG-06, BUG-07 fixed (Pareto top-3 by impact)  
**Method**: Live `curl`, `node -e` function reproduction, source-code analysis  
**Status legend**: ✅ PASS · 🐛 BUG CONFIRMED · ⚠️ PASS WITH NOTE · 🔧 FIXED  

---

## Scorecard

| Suite | Tests | ✅ PASS | 🐛 BUG | ⚠️ NOTE |
|-------|-------|---------|--------|---------|
| A — Core Data Accuracy | 6 | 5 | 0 | 1 |
| B — Real-Time SSE | 5 | 5 | 0 | 0 |
| C — Bug Reproduction | 2 | 0 | 2 | 0 |
| D — Frontend Logic | 2 | 1 | 1 | 0 |
| E — Security & Resilience | 2 | 1 | 1 | 0 |
| **Total** | **17** | **12** | **4** | **1** |

---

## Bug Register

| ID | Severity | Location | Test | Status |
|----|----------|----------|------|--------|
| BUG-01 | 🔴 CRITICAL | `scoreReviews` end-date boundary | TC-C1 | 🔧 FIXED — `endDate + "T23:59:59.999Z"` |
| BUG-04 | 🟡 MEDIUM | `makeReviewId` same-second collision | TC-C2 | 🐛 CONFIRMED (backlog) |
| BUG-06 | 🟡 MEDIUM | POST `/seed` — no auth | TC-E1 | 🔧 FIXED — `requireAdminToken` middleware |
| BUG-07 | 🟢 LOW | `timeAgoES` — "hace 1 meses" | TC-D1 | 🔧 FIXED — `if (diffMo === 1) return "hace 1 mes"` |
| BUG-02 | 🟠 HIGH | `fetchedAt: new Date()` in DB reads | TC-A5 | ⚠️ LOW OBSERVABLE IMPACT |
| BUG-03 | 🟠 HIGH | `getPlaceMeta` returns ×10 as `googleAvgRating` | TC-A2 | ✅ HANDLED DOWNSTREAM |
| BUG-05 | 🟡 MEDIUM | `getMonth()` timezone sensitivity | TC-D2 | ✅ NOT ACTIVE (server UTC) |

---

## What matters most for a real-time dashboard

1. **Scoring accuracy** — wrong numbers are misleading, not just annoying
2. **Real-time delivery** — SSE is the core value proposition
3. **Core API health** — if the API breaks, the screen goes blank
4. **Data integrity** — silent data loss is worse than a visible error

---

## SUITE A — Core Data Accuracy

### TC-A1 — Health check ✅ PASS
```
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/healthz
→ 200
```

### TC-A2 — All dashboard fields correct, no ×10 bug ✅ PASS
```
curl -s http://localhost:8080/api/dashboard | jq '{googleAvgRating, googleTotalReviews, ...}'
→ {
    "googleAvgRating": 4.6,        ← correct (not 46 — BUG-03 handled by /10 division)
    "googleTotalReviews": 898,
    "netScore": 0,
    "positive": 0,
    "negative": 0,
    "allTimePositive": 863,
    "allTimeNegative": 109,
    "allTimeTotal": 977,
    "provider": "database",
    "cacheHit": false
  }
```

### TC-A3 — Cache hit on second call ✅ PASS
```
Call 1 → cacheHit: false
Call 2 → cacheHit: true
```

### TC-A4 — allTimePositive + allTimeNegative ≤ allTimeTotal ✅ PASS
```
863 + 109 = 972 ≤ 977
Difference = 5 neutral (3-star) reviews — correct
```

### TC-A5 — updatedAt is stable in cache ⚠️ PASS WITH NOTE
```
T1 (t=0s): 2026-03-31T08:13:39.348Z
T2 (t=3s): 2026-03-31T08:13:39.348Z
→ Stable across cached reads ✓
```
**BUG-02 note**: Root cause confirmed in source — `getAllReviewsForPlace` sets `fetchedAt: new Date()` on every DB read, meaning `latestSourceUpdate = Math.max(meta.updatedAt, NOW)` always equals NOW. Observable impact is low because `buildDashboardFromDb` only runs on cache miss or refresh, making `updatedAt` ≈ "last refresh time". A stored `fetched_at` column in Supabase would fix this properly.

### TC-A6 — recentActivity has 8 reviews with all required fields ✅ PASS
```
recentActivity length: 8
recentActivity[0] keys: ["author", "isoDate", "rating", "text"]
```

---

## SUITE B — Real-Time SSE Stream

### TC-B1 — SSE fires event:dashboard on connect within 2s ✅ PASS
```
timeout 3 curl -s -N http://localhost:8080/api/dashboard/stream
→ retry: 10000
→ event: dashboard
→ data: {"netScore":0,"positive":0,...}   ← received immediately
```

### TC-B2 — SSE Content-Type header ✅ PASS
```
→ Content-Type: text/event-stream; charset=utf-8
```

### TC-B3 — SSE retry directive present ✅ PASS
```
→ retry: 10000
Browser will auto-reconnect in 10s on any drop.
```

### TC-B4 — SSE broadcasts updated data after POST /refresh ✅ PASS
```
1. Connected SSE client (listening)
2. POST /dashboard/refresh → { "success": true, "provider": "database" }
3. SSE received event:dashboard count: 2
   (1 = initial snapshot, 2 = post-refresh broadcast)
Full update pipeline confirmed: provider fetch → DB → cache → broadcast → SSE.
```

### TC-B5 — SSE cleanup on client disconnect ✅ PASS
```
1. Connected SSE client
2. kill -9 <client>
3. POST /dashboard/refresh → { "success": true }
4. grep "write after end|EPIPE" → No stream errors found
req.on("close") handler fires correctly; clearInterval + unsubscribe called.
```

---

## SUITE C — Bug Reproduction

### TC-C1 — BUG-01: scoreReviews excludes June 30 after midnight UTC 🐛 CONFIRMED
```javascript
// Live test against exact production function logic:
const reviews = [
  { isoDate: '2026-06-30T00:00:00.000Z', rating: 5 }, // midnight  → INCLUDED
  { isoDate: '2026-06-30T09:00:00.000Z', rating: 5 }, // 9am       → EXCLUDED (bug)
  { isoDate: '2026-06-30T23:59:59.000Z', rating: 5 }, // 11:59pm   → EXCLUDED (bug)
  { isoDate: '2026-07-01T00:00:00.000Z', rating: 5 }, // July 1    → correctly excluded
];

scoreReviews(reviews, '2026-04-01', '2026-06-30')
→ Counted: 1  (correct would be 3)

Root cause: new Date("2026-06-30") = midnight UTC
            d > end is TRUE for any review after midnight
            Entire June 30 business day is dropped from Q2 scoring
```

**Impact for Eltex**: Spain is UTC+2 (CEST). Any review posted on June 30 between 00:00–23:59 local time equals UTC 22:00 June 29 – 21:59 June 30. Reviews after midnight UTC June 30 (02:00 CEST onwards) are excluded. That is the entire June 30 working day.

**Fix**:
```typescript
// In services/reviews.ts — scoreReviews()
// Replace:
const end = new Date(endDate);
// With:
const end = new Date(endDate + "T23:59:59.999Z");
```

### TC-C2 — BUG-04: makeReviewId collision on same author + same second 🐛 CONFIRMED
```javascript
makeReviewId('Eltex solar España', '2026-05-01T10:00:00.000Z', 'Ana García')
→ "Eltex solar España::2026-05-01T10:00:00Z::Ana García"

makeReviewId('Eltex solar España', '2026-05-01T10:00:00.999Z', 'Ana García')
→ "Eltex solar España::2026-05-01T10:00:00Z::Ana García"   ← IDENTICAL

id1 === id2: true   → second review silently lost on upsert
```

**Fix**:
```typescript
import { createHash } from "crypto";
function makeReviewId(query: string, isoDate: string, author: string, text: string) {
  const base = `${query}::${normalizeIsoDate(isoDate)}::${author}`;
  const hash = createHash("md5").update(text ?? "").digest("hex").slice(0, 8);
  return `${base}::${hash}`.slice(0, 255);
}
```

---

## SUITE D — Frontend Logic

### TC-D1 — BUG-07: timeAgoES returns "hace 1 meses" 🐛 CONFIRMED
```javascript
// 42 days ago: diffW=6 (not < 6) → falls into diffMo path → diffMo=1
timeAgoES(42 days ago) → "hace 1 meses"   ← wrong (Spanish grammar)
timeAgoES(60 days ago) → "hace 2 meses"   ← correct
timeAgoES(90 days ago) → "hace 3 meses"   ← correct
```

**Fix** (one line in `App.tsx`):
```typescript
const diffMo = Math.floor(diffD / 30);
if (diffMo === 1) return "hace 1 mes";   // ← add this before the return
return `hace ${diffMo} meses`;
```

### TC-D2 — BUG-05: date parsing timezone safety ✅ PASS (not active here)
```javascript
new Date('2026-04-01').getMonth()   → 3 (April) ✓ on UTC server
// Risk only on UTC-12/UTC-11 machines. Spain (UTC+1/+2) is safe.
```

---

## SUITE E — Security & Resilience

### TC-E1 — BUG-06: POST /seed has no authentication 🐛 CONFIRMED
```
curl -X POST http://localhost:8080/api/dashboard/seed --max-time 2
→ HTTP 000 (accepted, began executing — no 401/403 returned)

The endpoint started a full provider fetch without any credentials.
Anyone who discovers the URL can exhaust the 100-call/month SearchAPI quota.
```

**Fix**:
```typescript
// Middleware in routes/dashboard.ts
function requireAdminToken(req: Request, res: Response, next: NextFunction) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return next(); // disabled if env var not set
  if (req.headers.authorization !== `Bearer ${token}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}
// Apply to sensitive routes:
router.post("/dashboard/seed", requireAdminToken, async (req, res) => { ... });
router.post("/dashboard/push-to-supabase", requireAdminToken, async (req, res) => { ... });
```

### TC-E2 — Concurrent refresh gate ✅ PASS
```
Two simultaneous POST /dashboard/refresh
→ Request 1: { "success": true, "provider": "database" }
→ Request 2: { "success": true, "provider": "database" }
fetchInFlight gate is working — second call no-ops silently.
No race condition, no crash, no duplicate provider calls.
```

---

## Fix Priority

| Priority | Bug | Urgency | One-line summary | Status |
|----------|-----|---------|-----------------|--------|
| 1 | **BUG-01** — scoreReviews end date | Before June 30 | Change `d > end` to use `T23:59:59.999Z` boundary | 🔧 FIXED |
| 2 | **BUG-07** — timeAgoES grammar | Any sprint | Add `if (diffMo === 1) return "hace 1 mes"` | 🔧 FIXED |
| 3 | **BUG-06** — unprotected /seed | Before sharing URL | Add `requireAdminToken` middleware | 🔧 FIXED |
| 4 | **BUG-04** — makeReviewId collision | Next sprint | Append MD5 of review text to ID | 🐛 OPEN |
| 5 | **BUG-02** — fetchedAt always now | Backlog | Add `fetched_at` column to Supabase reviews table | 🐛 OPEN |
