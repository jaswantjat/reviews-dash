import { Router, type IRouter, type Response } from "express";
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
} from "../services/reviews-db.js";
import { fetchAndStoreNewReviews as runProviderRefresh, isFetchInFlight } from "../services/poller.js";
import { fetchZendeskTickets } from "../services/zendesk.js";
import { logger } from "../lib/logger.js";
import type { RecentReview } from "../services/cache.js";

const router: IRouter = Router();
const HARDCODED_UPDATED_AT = "2026-03-27T08:09:02Z";

// ---------------------------------------------------------------------------
// HARDCODED DASHBOARD DATA
// All values confirmed as of 2026-03-27 from Google Maps + stored reviews.
// When live providers or a seeded DB are unavailable, this snapshot preserves
// a usable Railway deployment without pretending the data is fresher than it is.
// ---------------------------------------------------------------------------
const HARDCODED_DASHBOARD = {
  netScore: 0,
  positive: 0,
  negative: 0,
  objective: 270,
  trimesterName: "Q2 2026",
  trimesterStart: "2026-04-01",
  trimesterEnd: "2026-06-30",
  monthlyBreakdown: [
    { month: "April", positive: 0, negative: 0, net: 0 },
    { month: "May", positive: 0, negative: 0, net: 0 },
    { month: "June", positive: 0, negative: 0, net: 0 },
  ],
  locationBreakdown: [{ name: "Eltex", positive: 0, negative: 0, net: 0 }],
  totalFetched: 500,
  allTimePositive: 419,
  allTimeNegative: 79,
  allTimeTotal: 500,
  allTimeAvgRating: 4.4,
  googleTotalReviews: 897,
  googleAvgRating: 4.6,
  recentActivity: [
    {
      rating: 5,
      isoDate: "2026-03-27T08:09:02Z",
      text: "",
      author: "Sara Castaner",
    },
    {
      rating: 5,
      isoDate: "2026-03-26T22:20:37Z",
      text: "Contraté con Javier el comercial de Valencia y he qiedado muy satisfecho con la instalación y el trabajo realizado. Todo en tiempo y forma y muy profesional. Recomendable 100 x 100.",
      author: "Gamon Intermediacion, S.L.",
    },
    {
      rating: 4,
      isoDate: "2026-03-26T09:23:17Z",
      text: "Aunque el proceso se dilató más de lo esperado, el resultado final ha sido satisfactorio. Jordi (coordinador) y su equipo de instaladores hicieron un trabajo impecable. Un servicio técnico y de mediación excelente que compensa los tiempos de espera iniciales.",
      author: "mario solano",
    },
    {
      rating: 5,
      isoDate: "2026-03-25T21:38:05Z",
      text: "Muy contenta con la instalación, me ha gustado mucho como trabajan. Lo recomiendo lo hacen muy bien!!",
      author: "Lorena Rodriguez A.",
    },
    {
      rating: 5,
      isoDate: "2026-03-25T10:46:25Z",
      text: "El trato fue correcto, comercial e instalador, profesionales. Muy recomendable.",
      author: "DEPI FACIL DEPIFACIL",
    },
    {
      rating: 1,
      isoDate: "2026-03-25T09:22:16Z",
      text: "",
      author: "Ciudadano del mundo",
    },
    {
      rating: 5,
      isoDate: "2026-03-23T13:54:34Z",
      text: "",
      author: "tomas bordas tissier",
    },
    {
      rating: 5,
      isoDate: "2026-03-17T09:41:28Z",
      text: "",
      author: "Jorge velasco quintana",
    },
  ],
  updatedAt: HARDCODED_UPDATED_AT,
  provider: "baseline",
};

function normalizeIsoDate(isoDate: string): string {
  return isoDate.replace(/\.\d+Z$/, "Z");
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
  const zendeskData = await fetchZendeskTickets();
  let totalPositive = 0;
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
    const recentDbReviews = await getRecentReviewsForPlace(placeId, 8);
    const meta = await getPlaceMeta(placeId);

    const reviewsForScoring = dbReviews.map((review) => ({
      rating: review.rating,
      isoDate: review.isoDate,
    }));

    const scored = scoreReviews(
      reviewsForScoring,
      CONFIG.trimester.startDate,
      CONFIG.trimester.endDate,
      CONFIG.trimester.months,
    );

    const allTime = scoreAllTime(reviewsForScoring);

    totalPositive += scored.totalPositive;
    totalNegative += scored.totalNegative;
    totalFetched += dbReviews.length;
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

  const recentActivity = allRecentReviews
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
  const dbHasData =
    dbData.allTimeTotal > 0 ||
    dbData.googleTotalReviews > 0 ||
    dbData.recentActivity.length > 0;

  return {
    ...HARDCODED_DASHBOARD,
    netScore: dbData.netScore,
    positive: dbData.positive,
    negative: dbData.negative,
    monthlyBreakdown: dbData.monthlyBreakdown,
    locationBreakdown: dbData.locationBreakdown,
    allTimePositive: dbHasData ? dbData.allTimePositive : HARDCODED_DASHBOARD.allTimePositive,
    allTimeNegative: dbHasData ? dbData.allTimeNegative : HARDCODED_DASHBOARD.allTimeNegative,
    allTimeTotal: dbHasData ? dbData.allTimeTotal : HARDCODED_DASHBOARD.allTimeTotal,
    allTimeAvgRating: dbHasData ? dbData.allTimeAvgRating : HARDCODED_DASHBOARD.allTimeAvgRating,
    googleTotalReviews:
      dbData.googleTotalReviews > 0
        ? dbData.googleTotalReviews
        : HARDCODED_DASHBOARD.googleTotalReviews,
    googleAvgRating:
      dbData.googleAvgRating > 0
        ? dbData.googleAvgRating
        : HARDCODED_DASHBOARD.googleAvgRating,
    recentActivity:
      dbData.recentActivity.length > 0
        ? dbData.recentActivity
        : HARDCODED_DASHBOARD.recentActivity,
    openTickets: dbData.openTickets,
    oldestTicketDays: dbData.oldestTicketDays,
    updatedAt: dbHasData ? dbData.updatedAt : HARDCODED_DASHBOARD.updatedAt,
    provider: dbHasData ? "database" : HARDCODED_DASHBOARD.provider,
  };
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
      const data = await buildMergedDashboard();
      setReviewsCache(data);
      snapshot = { ...data, cacheHit: false };
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

router.post("/dashboard/seed", async (req, res) => {
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

export default router;
