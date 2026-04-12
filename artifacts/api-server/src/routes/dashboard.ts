import { Router, type IRouter, type Response, type Request, type NextFunction } from "express";
import { CONFIG } from "../config.js";
import {
  getReviewsCache,
  isReviewCacheStale,
  setReviewsCache,
  subscribeToReviewsCache,
} from "../services/cache.js";
import { fetchReviewsForLocation, scoreReviews, scoreAllTime } from "../services/reviews.js";
import {
  upsertReviews,
  upsertPlaceMeta,
  getAllReviewsForPlace,
  getRecentReviewsForPlace,
  getPlaceMeta,
  deleteReviewsNotIn,
} from "../services/reviews-db.js";
import { fetchAndStoreNewReviews as runProviderRefresh, isFetchInFlight } from "../services/poller.js";
import { logger } from "../lib/logger.js";
import type { RecentReview } from "../services/cache.js";
import {
  HARDCODED_DASHBOARD,
  HARDCODED_UPDATED_AT,
  mergeDashboardData,
} from "../services/dashboard-merge.js";
import { pushReviewsToSupabase, pushPlaceMetaToSupabase } from "@workspace/db/supabase";

const router: IRouter = Router();

function requireAdminToken(req: Request, res: Response, next: NextFunction) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return next();
  if (req.headers.authorization !== `Bearer ${token}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
}

function normalizeIsoDate(isoDate: string): string {
  return isoDate.replace(/\.\d+Z$/, "Z");
}

/** Deduplicate reviews by normalised ISO-date + rating.
 *  Prefer named authors over "Anonymous" and reviews with text over those without. */
function deduplicateRecentReviews<T extends { rating: number; isoDate: string; text: string; author: string }>(
  reviews: T[]
): T[] {
  const seen = new Map<string, T>();
  for (const r of reviews) {
    const key = `${normalizeIsoDate(r.isoDate)}::${r.rating}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, r);
    } else {
      const existingIsAnon = existing.author === "Anonymous";
      const newIsAnon = r.author === "Anonymous";
      if (existingIsAnon && !newIsAnon) {
        seen.set(key, r); // prefer named author
      } else if (!existing.text.trim() && r.text.trim()) {
        seen.set(key, r); // prefer review with text
      }
    }
  }
  return Array.from(seen.values());
}

function makeReviewId(googleMapsQuery: string, isoDate: string, author: string) {
  return `${googleMapsQuery}::${normalizeIsoDate(isoDate)}::${author}`.slice(0, 255);
}

// Generate a stable place ID from the query string for database lookups
function getPlaceIdFromQuery(googleMapsQuery: string): string {
  return Buffer.from(googleMapsQuery).toString('base64').slice(0, 255);
}

function getTimestamp(value: Date | string | null | undefined) {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function writeSseEvent(res: Response, event: string, payload: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function triggerBackgroundRefresh(reason: string) {
  if (isFetchInFlight()) return;

  logger.info({ reason }, "Triggering background dashboard refresh");
  void runProviderRefresh(2, buildMergedDashboard).catch((err) => {
    logger.error({ err, reason }, "Background dashboard refresh failed");
  });
}

async function buildDashboardFromDb() {
  const zendeskData = { openTickets: 0, oldestTicketDays: 0 };
  let totalPositive = 0;
  let totalNeutral = 0;
  let totalNegative = 0;
  let totalFetched = 0;
  const monthlyTotals: Record<string, { positive: number; negative: number }> = {};
  CONFIG.trimester.months.forEach((month) => {
    monthlyTotals[month] = { positive: 0, negative: 0 };
  });

  let allTimePositive = 0;
  let allTimeNegative = 0;
  let allTimeTotal = 0;
  let allTimeRatingSum = 0;
  let googleTotalReviews = 0;
  let googleWeightedRating = 0;
  let googleRatingWeight = 0;
  let latestSourceUpdate = 0;

  const allRecentReviews: RecentReview[] = [];
  const locationBreakdown: Array<{
    name: string;
    positive: number;
    negative: number;
    net: number;
  }> = [];

  for (const loc of CONFIG.locations) {
    const placeId = getPlaceIdFromQuery(loc.googleMapsQuery);

    const dbReviews = await getAllReviewsForPlace(placeId);
    const recentDbReviews = await getRecentReviewsForPlace(placeId, 40); // fetch extra for dedup headroom
    const meta = await getPlaceMeta(placeId);

    const reviewsRaw = dbReviews.map((review) => ({
      rating: review.rating,
      isoDate: review.isoDate,
    }));

    // Deduplicate by normalised timestamp + rating (same logic as carousel).
    // Providers occasionally return the same physical review twice — once with
    // the author's name and once as Anonymous — with timestamps that differ by
    // only a few milliseconds. Normalising strips sub-second precision so both
    // collapse to the same key and only one is counted.
    const dedupSeen = new Map<string, { rating: number; isoDate: string }>();
    for (const r of reviewsRaw) {
      const key = `${normalizeIsoDate(r.isoDate)}::${r.rating}`;
      if (!dedupSeen.has(key)) dedupSeen.set(key, r);
    }
    const reviewsForScoring = Array.from(dedupSeen.values());

    const scored = scoreReviews(
      reviewsForScoring,
      CONFIG.trimester.startDate,
      CONFIG.trimester.endDate,
      CONFIG.trimester.months,
    );

    const allTime = scoreAllTime(reviewsForScoring);

    totalPositive += scored.totalPositive;
    totalNeutral += scored.totalNeutral;
    totalNegative += scored.totalNegative;
    totalFetched += reviewsForScoring.length;
    allTimePositive += allTime.positive;
    allTimeNegative += allTime.negative;
    allTimeTotal += allTime.total;
    allTimeRatingSum += reviewsForScoring.reduce((sum, review) => sum + review.rating, 0);

    const placeGoogleTotal =
      meta && meta.googleTotalReviews > 0 ? meta.googleTotalReviews : allTime.total;
    const placeGoogleAvg =
      meta && meta.googleTotalReviews > 0 ? meta.googleAvgRating / 10 : allTime.avgRating;

    googleTotalReviews += placeGoogleTotal;
    if (placeGoogleTotal > 0) {
      googleWeightedRating += placeGoogleAvg * placeGoogleTotal;
      googleRatingWeight += placeGoogleTotal;
    } else if (placeGoogleAvg > 0) {
      googleWeightedRating += placeGoogleAvg;
      googleRatingWeight += 1;
    }

    scored.monthlyBreakdown.forEach((month) => {
      if (monthlyTotals[month.month]) {
        monthlyTotals[month.month].positive += month.positive;
        monthlyTotals[month.month].negative += month.negative;
      }
    });

    allRecentReviews.push(
      ...recentDbReviews.map((review) => ({
        rating: review.rating,
        isoDate: review.isoDate,
        text: review.reviewText ?? "",
        author: review.author ?? "Anonymous",
      })),
    );

    latestSourceUpdate = Math.max(
      latestSourceUpdate,
      getTimestamp(meta?.updatedAt),
      getTimestamp(recentDbReviews[0]?.fetchedAt),
    );

    locationBreakdown.push({
      name: loc.name,
      positive: scored.totalPositive,
      negative: scored.totalNegative,
      net: scored.totalPositive - scored.totalNegative,
    });
  }

  const recentActivity = deduplicateRecentReviews(allRecentReviews)
    .sort((a, b) => new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime())
    .slice(0, 8);

  const monthlyBreakdown = CONFIG.trimester.months.map((month) => ({
    month,
    positive: monthlyTotals[month].positive,
    negative: monthlyTotals[month].negative,
    net: monthlyTotals[month].positive - monthlyTotals[month].negative,
  }));

  return {
    netScore: totalPositive - totalNegative,
    positive: totalPositive,
    neutral: totalNeutral,
    negative: totalNegative,
    objective: CONFIG.trimester.objective,
    totalFetched,
    allTimePositive,
    allTimeNegative,
    allTimeTotal,
    allTimeAvgRating: allTimeTotal > 0 ? Math.round((allTimeRatingSum / allTimeTotal) * 10) / 10 : 0,
    googleTotalReviews,
    googleAvgRating: googleRatingWeight > 0 ? Math.round((googleWeightedRating / googleRatingWeight) * 10) / 10 : 0,
    trimesterName: CONFIG.trimester.name,
    trimesterStart: CONFIG.trimester.startDate,
    trimesterEnd: CONFIG.trimester.endDate,
    monthlyBreakdown,
    locationBreakdown,
    recentActivity,
    openTickets: zendeskData.openTickets,
    oldestTicketDays: zendeskData.oldestTicketDays,
    updatedAt: latestSourceUpdate
      ? new Date(latestSourceUpdate).toISOString()
      : HARDCODED_UPDATED_AT,
    provider: "database",
  };
}

export async function buildMergedDashboard() {
  const dbData = await buildDashboardFromDb();
  return mergeDashboardData(dbData);
}

router.get("/dashboard/stream", async (req, res) => {
  try {
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();
    res.write("retry: 10000\n\n");

    let snapshot = getReviewsCache();
    if (!snapshot) {
      try {
        const data = await buildMergedDashboard();
        setReviewsCache(data);
        snapshot = { ...data, cacheHit: false };
      } catch (dbErr) {
        req.log.error({ err: dbErr }, "Dashboard stream: DB unavailable, sending baseline");
        snapshot = { ...HARDCODED_DASHBOARD, cacheHit: false };
        // Trigger a background refresh once DB recovers
        triggerBackgroundRefresh("stream-db-error-fallback");
      }
    }

    writeSseEvent(res, "dashboard", snapshot);

    if (isReviewCacheStale()) {
      triggerBackgroundRefresh("stream-connected-with-stale-cache");
    }

    const heartbeat = setInterval(() => {
      writeSseEvent(res, "heartbeat", { ts: new Date().toISOString() });
    }, CONFIG.polling.streamHeartbeatMs);

    const unsubscribe = subscribeToReviewsCache((data) => {
      writeSseEvent(res, "dashboard", { ...data, cacheHit: false });
    });

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    });
  } catch (err) {
    req.log.error({ err }, "Dashboard stream error");
    if (!res.headersSent) {
      res.status(500).end();
    } else {
      res.end();
    }
  }
});

router.get("/dashboard", async (req, res) => {
  try {
    const cached = getReviewsCache();
    if (cached) {
      if (isReviewCacheStale()) {
        triggerBackgroundRefresh("dashboard-get-stale-cache");
      }
      return res.json({ ...cached, cacheHit: true });
    }

    const data = await buildMergedDashboard();
    setReviewsCache(data);

    if (data.provider === "baseline") {
      triggerBackgroundRefresh("dashboard-get-cold-start");
    }

    return res.json({ ...data, cacheHit: false });
  } catch (err) {
    req.log.error({ err }, "Dashboard error");
    return res.json({ ...HARDCODED_DASHBOARD, cacheHit: false });
  }
});

router.post("/dashboard/refresh", async (req, res) => {
  try {
    await runProviderRefresh(2, buildMergedDashboard);
    const cached = getReviewsCache();
    return res.json({
      success: true,
      message: "Fetched new reviews and refreshed dashboard from database",
      provider: cached?.provider ?? "database",
    });
  } catch (err) {
    req.log.error({ err }, "Manual refresh failed");
    return res.status(500).json({
      success: false,
      message: String(err),
      provider: "error",
    });
  }
});

router.post("/dashboard/seed", requireAdminToken, async (req, res) => {
  try {
    const results: Array<{ location: string; fetched: number; provider: string }> = [];

    for (const loc of CONFIG.locations) {
      const placeId = getPlaceIdFromQuery(loc.googleMapsQuery);

      req.log.info({ location: loc.name }, "Seeding reviews — fetching all pages");
      const result = await fetchReviewsForLocation(loc.name, loc.googleMapsQuery, 50);

      if (result.reviews.length === 0) {
        results.push({ location: loc.name, fetched: 0, provider: result.provider });
        continue;
      }

      const toInsert = result.reviews.map((review) => ({
        id: makeReviewId(loc.googleMapsQuery, review.isoDate, review.author ?? "Anonymous"),
        placeId,
        locationName: loc.name,
        rating: review.rating,
        isoDate: review.isoDate,
        reviewText: review.text ?? "",
        author: review.author ?? "Anonymous",
      }));

      await upsertReviews(toInsert);
      await upsertPlaceMeta(
        placeId,
        loc.name,
        result.placeInfo.googleTotalReviews,
        result.placeInfo.googleAvgRating,
        true,
      );

      results.push({
        location: loc.name,
        fetched: result.totalFetched,
        provider: result.provider,
      });
    }

    const data = await buildMergedDashboard();
    setReviewsCache(data);

    return res.json({
      success: true,
      message: "Seed complete — all reviews saved to database",
      results,
      summary: {
        totalInDb: data.allTimeTotal,
        positive: data.positive,
        negative: data.negative,
        netScore: data.netScore,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Seed failed");
    return res.status(500).json({ success: false, message: String(err) });
  }
});

/**
 * POST /api/dashboard/cleanup
 *
 * Full sync with Google Maps:
 *  1. Fetch every current review (up to 50 pages) from the provider cascade.
 *  2. Upsert them into the DB.
 *  3. Delete any DB review that Google no longer shows (de-indexed reviews).
 *  4. Update place_meta with the fresh Google total + rating.
 *  5. Rebuild the dashboard cache.
 *
 * This can take 30-90 s depending on API response times.
 */
router.post("/dashboard/cleanup", requireAdminToken, async (req, res) => {
  try {
    const report: Array<{
      location: string;
      fetched: number;
      upserted: number;
      deleted: number;
      newGoogleTotal: number;
      provider: string;
    }> = [];

    for (const loc of CONFIG.locations) {
      const placeId = getPlaceIdFromQuery(loc.googleMapsQuery);

      req.log.info({ location: loc.name }, "Cleanup: fetching all current Google reviews (50 pages)");
      const result = await fetchReviewsForLocation(loc.name, loc.googleMapsQuery, 50);

      if (result.reviews.length === 0) {
        req.log.warn({ location: loc.name }, "Cleanup: provider returned 0 reviews — skipping delete step");
        report.push({ location: loc.name, fetched: 0, upserted: 0, deleted: 0, newGoogleTotal: 0, provider: result.provider });
        continue;
      }

      // Safety threshold: only proceed with deletion if we fetched at least 90%
      // of Google's known total. If the provider returns only 80 out of 899 reviews,
      // deleting everything else would destroy historical data — not de-indexed reviews.
      const knownGoogleTotal = result.placeInfo.googleTotalReviews;
      const coveragePct = knownGoogleTotal > 0
        ? (result.reviews.length / knownGoogleTotal) * 100
        : 100;

      if (knownGoogleTotal > 0 && result.reviews.length < knownGoogleTotal * 0.9) {
        req.log.warn(
          { location: loc.name, fetched: result.reviews.length, googleTotal: knownGoogleTotal, coveragePct: coveragePct.toFixed(1) },
          "Cleanup: provider returned insufficient coverage — skipping delete step to protect historical data",
        );
        // Still upsert what we have (new reviews) but do NOT delete anything
        const toInsert = result.reviews.map((review) => ({
          id: makeReviewId(loc.googleMapsQuery, review.isoDate, review.author ?? "Anonymous"),
          placeId,
          locationName: loc.name,
          rating: review.rating,
          isoDate: review.isoDate,
          reviewText: review.text ?? "",
          author: review.author ?? "Anonymous",
        }));
        await upsertReviews(toInsert);
        report.push({ location: loc.name, fetched: result.totalFetched, upserted: toInsert.length, deleted: 0, newGoogleTotal: knownGoogleTotal, provider: `${result.provider} (coverage too low: ${coveragePct.toFixed(1)}% — delete skipped)` });
        continue;
      }

      // Build the canonical ID set for every review Google currently shows
      const keepIds = new Set(
        result.reviews.map((r) =>
          makeReviewId(loc.googleMapsQuery, r.isoDate, r.author ?? "Anonymous"),
        ),
      );

      // 1. Upsert current reviews
      const toInsert = result.reviews.map((review) => ({
        id: makeReviewId(loc.googleMapsQuery, review.isoDate, review.author ?? "Anonymous"),
        placeId,
        locationName: loc.name,
        rating: review.rating,
        isoDate: review.isoDate,
        reviewText: review.text ?? "",
        author: review.author ?? "Anonymous",
      }));
      await upsertReviews(toInsert);

      // 2. Delete de-indexed reviews (in DB but not in the current Google set)
      const deleted = await deleteReviewsNotIn(placeId, keepIds);

      // 3. Update place_meta with fresh Google total and rating
      await upsertPlaceMeta(
        placeId,
        loc.name,
        result.placeInfo.googleTotalReviews,
        result.placeInfo.googleAvgRating,
        true,
      );

      req.log.info(
        { location: loc.name, fetched: result.totalFetched, upserted: toInsert.length, deleted, googleTotal: result.placeInfo.googleTotalReviews },
        "Cleanup complete for location",
      );

      report.push({
        location: loc.name,
        fetched: result.totalFetched,
        upserted: toInsert.length,
        deleted,
        newGoogleTotal: result.placeInfo.googleTotalReviews,
        provider: result.provider,
      });
    }

    // Rebuild dashboard cache from the clean DB
    const data = await buildMergedDashboard();
    setReviewsCache(data);

    return res.json({
      success: true,
      message: "Cleanup complete — DB now matches current Google Maps reviews",
      report,
      summary: {
        totalInDb: data.allTimeTotal,
        allTimePositive: data.allTimePositive,
        allTimeNegative: data.allTimeNegative,
        googleTotalReviews: data.googleTotalReviews,
        netScore: data.netScore,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Cleanup failed");
    return res.status(500).json({ success: false, message: String(err) });
  }
});

router.post("/dashboard/push-to-supabase", requireAdminToken, async (req, res) => {
  try {
    const summary: Array<{ location: string; reviewsPushed: number; metaOk: boolean; errors: number; note?: string }> = [];

    for (const loc of CONFIG.locations) {
      const placeId = getPlaceIdFromQuery(loc.googleMapsQuery);

      const dbRows = await getAllReviewsForPlace(placeId);
      if (dbRows.length === 0) {
        summary.push({ location: loc.name, reviewsPushed: 0, metaOk: false, errors: 0, note: "No reviews in local DB — run /seed first" });
        continue;
      }

      const supabaseReviews = dbRows.map((r) => ({
        id: r.id,
        place_id: r.placeId,
        location_name: r.locationName,
        rating: r.rating,
        iso_date: r.isoDate,
        review_text: r.reviewText ?? "",
        author: r.author ?? "Anonymous",
      }));

      const { inserted, errors, lastError } = await pushReviewsToSupabase(supabaseReviews);

      const meta = await getPlaceMeta(placeId);
      const metaResult = await pushPlaceMetaToSupabase({
        place_id: placeId,
        location_name: loc.name,
        google_total_reviews: meta?.googleTotalReviews ?? 0,
        google_avg_rating_x10: meta?.googleAvgRating ?? 0,
        last_seeded_at: meta?.lastSeededAt ? meta.lastSeededAt.toISOString() : null,
        updated_at: new Date().toISOString(),
      });

      summary.push({
        location: loc.name,
        reviewsPushed: inserted,
        metaOk: metaResult.ok,
        errors,
        ...(lastError && { note: `Supabase error: ${lastError}` }),
        ...(metaResult.error && { metaError: metaResult.error }),
      });
    }

    return res.json({ success: true, summary });
  } catch (err) {
    req.log.error({ err }, "push-to-supabase failed");
    return res.status(500).json({ success: false, message: String(err) });
  }
});

export default router;
