import { Router, type IRouter } from "express";
import { CONFIG } from "../config.js";
import {
  getReviewsCache,
  setReviewsCache,
  buildEmptyDashboard,
} from "../services/cache.js";
import { fetchReviewsForLocation, scoreReviews, scoreAllTime } from "../services/reviews.js";
import {
  upsertReviews,
  upsertPlaceMeta,
  getAllReviewsForPlace,
  getRecentReviewsForPlace,
  getPlaceMeta,
} from "../services/reviews-db.js";
import type { RecentReview } from "../services/cache.js";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// HARDCODED DASHBOARD DATA
// All values confirmed as of 2026-03-27 from Google Maps + stored reviews.
// When SearchAPI credits renew and a full seed is run, the GET endpoint can
// be switched back to buildDashboardFromDb(). Until then, these values are
// the ground truth.
// ---------------------------------------------------------------------------
const HARDCODED_DASHBOARD = {
  // Q2 2026 trimester (starts 2026-04-01 — no reviews in period yet)
  netScore: 0,
  positive: 0,
  negative: 0,
  objective: 270,
  trimesterName: "Q2 2026",
  trimesterStart: "2026-04-01",
  trimesterEnd: "2026-06-30",
  monthlyBreakdown: [
    { month: "April",  positive: 0, negative: 0, net: 0 },
    { month: "May",    positive: 0, negative: 0, net: 0 },
    { month: "June",   positive: 0, negative: 0, net: 0 },
  ],
  locationBreakdown: [
    { name: "Eltex", positive: 0, negative: 0, net: 0 },
  ],

  // All-time stats (based on 500 stored reviews — 419 positive, 79 negative)
  totalFetched: 500,
  allTimePositive: 419,
  allTimeNegative: 79,
  allTimeTotal: 500,
  allTimeAvgRating: 4.4,

  // Official Google Maps figures (verified 2026-03-27 via google_maps engine)
  googleTotalReviews: 897,
  googleAvgRating: 4.6,

  // 8 most recent reviews — text sourced directly from Google Maps API response
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

  provider: "hardcoded",
};

function normalizeIsoDate(isoDate: string): string {
  // Strip sub-second precision so HasData ("...02Z") and SearchAPI ("...02.643Z") produce the same ID
  return isoDate.replace(/\.\d+Z$/, "Z");
}

function makeReviewId(placeId: string, isoDate: string, author: string) {
  return `${placeId}::${normalizeIsoDate(isoDate)}::${author}`.slice(0, 255);
}

async function buildDashboardFromDb() {
  let totalPositive = 0;
  let totalNegative = 0;
  let totalFetched = 0;
  const monthlyTotals: Record<string, { positive: number; negative: number }> = {};
  CONFIG.trimester.months.forEach((m) => (monthlyTotals[m] = { positive: 0, negative: 0 }));

  let allTimePositive = 0;
  let allTimeNegative = 0;
  let allTimeTotal = 0;
  let allTimeAvgRating = 0;
  let googleTotalReviews = 0;
  let googleAvgRating = 0;

  const allRecentReviews: RecentReview[] = [];
  const locationBreakdown = [];

  for (const loc of CONFIG.locations) {
    if (!loc.placeId) continue;

    const dbReviews = await getAllReviewsForPlace(loc.placeId);
    const recentDbReviews = await getRecentReviewsForPlace(loc.placeId, 8);
    const meta = await getPlaceMeta(loc.placeId);

    const reviewsForScoring = dbReviews.map((r) => ({
      rating: r.rating,
      isoDate: r.isoDate,
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
    allTimeAvgRating = allTime.avgRating;

    // Use place_meta if available and populated (HasData provides this).
    // Fall back to stats computed from stored reviews when the provider
    // doesn't return place-level info (e.g. SearchAPI reviews endpoint).
    if (meta && meta.googleTotalReviews > 0) {
      googleTotalReviews = meta.googleTotalReviews;
      googleAvgRating = meta.googleAvgRating / 10;
    } else {
      googleTotalReviews = allTime.total;
      googleAvgRating = allTime.avgRating;
    }

    scored.monthlyBreakdown.forEach((mb) => {
      if (monthlyTotals[mb.month]) {
        monthlyTotals[mb.month].positive += mb.positive;
        monthlyTotals[mb.month].negative += mb.negative;
      }
    });

    allRecentReviews.push(
      ...recentDbReviews.map((r) => ({
        rating: r.rating,
        isoDate: r.isoDate,
        text: r.reviewText ?? "",
        author: r.author ?? "Anonymous",
      })),
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

  const monthlyBreakdown = CONFIG.trimester.months.map((m) => ({
    month: m,
    positive: monthlyTotals[m].positive,
    negative: monthlyTotals[m].negative,
    net: monthlyTotals[m].positive - monthlyTotals[m].negative,
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
    allTimeAvgRating,
    googleTotalReviews,
    googleAvgRating,
    trimesterName: CONFIG.trimester.name,
    trimesterStart: CONFIG.trimester.startDate,
    trimesterEnd: CONFIG.trimester.endDate,
    monthlyBreakdown,
    locationBreakdown,
    recentActivity,
    updatedAt: new Date().toISOString(),
    provider: "database",
  };
}

// ---------------------------------------------------------------------------
// Build the final dashboard by merging the hardcoded historical baseline with
// any new Q2 reviews that have been stored in the database.
// Historical all-time stats (pre-Q2) are always sourced from HARDCODED_DASHBOARD.
// New trimester scores are computed live from the DB.
// ---------------------------------------------------------------------------
async function buildMergedDashboard() {
  const dbData = await buildDashboardFromDb();

  // When the DB is populated, use its all-time stats directly (they reflect all seeded reviews).
  // When the DB is empty (first boot, APIs down), fall back to the hardcoded baseline so
  // the dashboard never shows zeros.
  const dbHasData = dbData.allTimeTotal > 0;

  return {
    ...HARDCODED_DASHBOARD,
    // Q2 trimester scores from DB (0 until new reviews arrive after Apr 1)
    netScore: dbData.netScore,
    positive: dbData.positive,
    negative: dbData.negative,
    monthlyBreakdown: dbData.monthlyBreakdown,
    locationBreakdown: dbData.locationBreakdown,
    // All-time: live DB values when seeded, hardcoded fallback when DB is empty
    allTimePositive: dbHasData ? dbData.allTimePositive : HARDCODED_DASHBOARD.allTimePositive,
    allTimeNegative: dbHasData ? dbData.allTimeNegative : HARDCODED_DASHBOARD.allTimeNegative,
    allTimeTotal: dbHasData ? dbData.allTimeTotal : HARDCODED_DASHBOARD.allTimeTotal,
    // Google meta: live from DB if available, else hardcoded baseline
    googleTotalReviews: dbData.googleTotalReviews > 0 ? dbData.googleTotalReviews : HARDCODED_DASHBOARD.googleTotalReviews,
    googleAvgRating: dbData.googleAvgRating > 0 ? dbData.googleAvgRating : HARDCODED_DASHBOARD.googleAvgRating,
    // Recent activity from DB when available
    recentActivity: dbData.recentActivity.length > 0 ? dbData.recentActivity : HARDCODED_DASHBOARD.recentActivity,
    updatedAt: new Date().toISOString(),
    provider: dbHasData ? "database" : "hardcoded",
  };
}

async function fetchAndStoreNewReviews() {
  for (const loc of CONFIG.locations) {
    if (!loc.placeId) continue;

    const result = await fetchReviewsForLocation(loc.name, loc.placeId, 2, loc.googleMapsQuery ?? "");

    if (result.reviews.length === 0) continue;

    const toInsert = result.reviews.map((r) => ({
      id: makeReviewId(loc.placeId, r.isoDate, r.author ?? "Anonymous"),
      placeId: loc.placeId,
      locationName: loc.name,
      rating: r.rating,
      isoDate: r.isoDate,
      reviewText: r.text ?? "",
      author: r.author ?? "Anonymous",
    }));

    await upsertReviews(toInsert);

    if (result.placeInfo.googleTotalReviews > 0) {
      await upsertPlaceMeta(
        loc.placeId,
        loc.name,
        result.placeInfo.googleTotalReviews,
        result.placeInfo.googleAvgRating,
        false,
      );
    }
  }

  const merged = await buildMergedDashboard();
  setReviewsCache(merged);
}

router.get("/dashboard", async (req, res) => {
  try {
    const cached = getReviewsCache();
    if (cached) {
      return res.json({ ...cached, cacheHit: true });
    }

    const data = await buildMergedDashboard();
    setReviewsCache(data);
    return res.json({ ...data, cacheHit: false });
  } catch (err) {
    req.log.error({ err }, "Dashboard error");
    return res.json({ ...HARDCODED_DASHBOARD, cacheHit: false });
  }
});

router.post("/dashboard/refresh", async (req, res) => {
  try {
    await fetchAndStoreNewReviews();
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
      if (!loc.placeId) continue;

      req.log.info({ location: loc.name }, "Seeding reviews — fetching all pages");
      const result = await fetchReviewsForLocation(loc.name, loc.placeId, 50, loc.googleMapsQuery ?? "");

      if (result.reviews.length === 0) {
        results.push({ location: loc.name, fetched: 0, provider: result.provider });
        continue;
      }

      const toInsert = result.reviews.map((r) => ({
        id: makeReviewId(loc.placeId, r.isoDate, r.author ?? "Anonymous"),
        placeId: loc.placeId,
        locationName: loc.name,
        rating: r.rating,
        isoDate: r.isoDate,
        reviewText: r.text ?? "",
        author: r.author ?? "Anonymous",
      }));

      await upsertReviews(toInsert);

      await upsertPlaceMeta(
        loc.placeId,
        loc.name,
        result.placeInfo.googleTotalReviews,
        result.placeInfo.googleAvgRating,
        true,
      );

      results.push({ location: loc.name, fetched: result.totalFetched, provider: result.provider });
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
