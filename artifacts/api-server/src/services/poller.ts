import { CONFIG } from "../config.js";
import { logger } from "../lib/logger.js";
import { fetchReviewsForLocation } from "./reviews.js";
import { upsertReviews, upsertPlaceMeta } from "./reviews-db.js";
import { setReviewsCache } from "./cache.js";
import { supabaseAdmin } from "@workspace/db/supabase";

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

let fetchInFlight = false;

export function isFetchInFlight(): boolean {
  return fetchInFlight;
}

export async function fetchAndStoreNewReviews(
  maxPages = 2,
  buildDashboard: () => Promise<ReturnType<typeof setReviewsCache> extends void ? any : any>,
): Promise<void> {
  if (fetchInFlight) {
    logger.warn("fetchAndStoreNewReviews skipped — already in flight");
    return;
  }
  fetchInFlight = true;
  try {
    for (const loc of CONFIG.locations) {
      const placeId = getPlaceIdFromQuery(loc.googleMapsQuery);

      const result = await fetchReviewsForLocation(loc.name, loc.googleMapsQuery, maxPages);

      if (result.reviews.length === 0) continue;

      const toInsert = result.reviews.map((r) => ({
        id: makeReviewId(loc.googleMapsQuery, r.isoDate, r.author ?? "Anonymous"),
        placeId,
        locationName: loc.name,
        rating: r.rating,
        isoDate: r.isoDate,
        reviewText: r.text ?? "",
        author: r.author ?? "Anonymous",
      }));

      await upsertReviews(toInsert);

      if (result.placeInfo.googleTotalReviews > 0) {
        await upsertPlaceMeta(
          placeId,
          loc.name,
          result.placeInfo.googleTotalReviews,
          result.placeInfo.googleAvgRating,
          false,
        );
      }
    }

    const data = await buildDashboard();
    setReviewsCache(data);
  } finally {
    fetchInFlight = false;
  }
}

export function startPolling(
  buildDashboard: () => Promise<any>,
): void {
  const intervalMs = CONFIG.polling.reviewsIntervalMs;
  logger.info({ intervalMs }, "Background polling started");

  setInterval(async () => {
    logger.info("Background poll: fetching new reviews");
    try {
      await fetchAndStoreNewReviews(2, buildDashboard);
      logger.info("Background poll: complete");
    } catch (err) {
      logger.error({ err }, "Background poll failed");
    }
  }, intervalMs);
}

// Ping the database every 12 hours to prevent Supabase free-tier deactivation
// (Supabase pauses projects after 1 week of inactivity)
const KEEP_ALIVE_INTERVAL_MS = 12 * 60 * 60 * 1000;

export function startKeepAlive(): void {
  logger.info({ intervalMs: KEEP_ALIVE_INTERVAL_MS }, "Supabase keep-alive started");

  const ping = async () => {
    try {
      const { error } = await supabaseAdmin
        .from("place_meta")
        .select("place_id")
        .limit(1);
      if (error) throw new Error(error.message);
      logger.info("Supabase keep-alive ping: ok");
    } catch (err) {
      logger.warn({ err }, "Supabase keep-alive ping failed");
    }
  };

  // Run once immediately on startup, then on schedule
  ping();
  setInterval(ping, KEEP_ALIVE_INTERVAL_MS);
}
