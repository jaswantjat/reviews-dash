import { CONFIG } from "../config.js";
import { logger } from "../lib/logger.js";
import { fetchReviewsForLocation } from "./reviews.js";
import { upsertReviews, upsertPlaceMeta } from "./reviews-db.js";
import { setReviewsCache } from "./cache.js";

function normalizeIsoDate(isoDate: string): string {
  return isoDate.replace(/\.\d+Z$/, "Z");
}

function makeReviewId(placeId: string, isoDate: string, author: string) {
  return `${placeId}::${normalizeIsoDate(isoDate)}::${author}`.slice(0, 255);
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
      if (!loc.placeId) continue;

      const result = await fetchReviewsForLocation(loc.name, loc.placeId, maxPages);

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
