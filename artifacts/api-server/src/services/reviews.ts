import { CONFIG } from "../config.js";
import { logger } from "../lib/logger.js";

export interface Review {
  rating: number;
  isoDate: string;
  text?: string;
  author?: string;
}

export interface RecentReview {
  rating: number;
  isoDate: string;
  text: string;
  author: string;
}

export interface PlaceInfo {
  googleTotalReviews: number;
  googleAvgRating: number;
}

export interface LocationResult {
  name: string;
  reviews: Review[];
  recentReviews: RecentReview[];
  totalFetched: number;
  placeInfo: PlaceInfo;
  provider: string;
}

interface ProviderError extends Error {
  status?: number;
}

/**
 * Fetch the real Google Maps total review count and average rating using
 * the google_maps engine (a separate call from the reviews endpoint, which
 * does not return place-level info).
 */
async function fetchPlaceInfoFromSearchAPI(
  query: string,
  apiKey: string,
): Promise<PlaceInfo> {
  try {
    const params = new URLSearchParams({
      engine: "google_maps",
      q: query,
      api_key: apiKey,
    });
    const res = await fetch(`https://www.searchapi.io/api/v1/search?${params}`);
    if (!res.ok) return { googleTotalReviews: 0, googleAvgRating: 0 };

    const data = (await res.json()) as {
      local_results?: Array<{ reviews?: number; rating?: number; title?: string }>;
    };

    const first = data.local_results?.[0];
    if (!first || !first.reviews) return { googleTotalReviews: 0, googleAvgRating: 0 };

    logger.info(
      { title: first.title, total: first.reviews, rating: first.rating },
      "Place info fetched from google_maps engine",
    );

    return {
      googleTotalReviews: first.reviews ?? 0,
      googleAvgRating: first.rating ?? 0,
    };
  } catch (err) {
    logger.warn({ err }, "fetchPlaceInfoFromSearchAPI failed — using zero fallback");
    return { googleTotalReviews: 0, googleAvgRating: 0 };
  }
}

async function fetchFromSearchAPI(
  googleMapsQuery: string,
  maxPages = 3,
  key = CONFIG.providers.searchapi.apiKeys[0],
): Promise<LocationResult & { name: string }> {
  if (!key) throw Object.assign(new Error("SEARCHAPI_KEY not set"), { status: 0 });

  // The google_maps_reviews engine requires place_id, not a text query.
  const placeId = process.env.PLACE_ID_ELTEX || "ChIJhTCaeeajpBIR4O9YniCqiJ0";

  // Fetch the real total & rating in parallel with the first page of reviews.
  const placeInfoPromise = fetchPlaceInfoFromSearchAPI(googleMapsQuery, key);

  const allReviews: Review[] = [];
  let nextPageToken: string | undefined;
  let page = 0;

  do {
    const params = new URLSearchParams({
      engine: "google_maps_reviews",
      place_id: placeId,
      sort_by: "newest",
      num: "20", // max reviews per page
      api_key: key,
    });
    if (nextPageToken) params.set("next_page_token", nextPageToken);

    const res = await fetch(`https://www.searchapi.io/api/v1/search?${params}`);

    if (res.status === 429 || res.status === 403) {
      if (page === 0) {
        // Failed on the very first page — signal to try the next provider.
        const err: ProviderError = new Error(`SearchAPI rate limit: ${res.status}`);
        err.status = res.status;
        throw err;
      }
      // Rate-limited mid-fetch — return what we have so far rather than discarding it.
      logger.warn({ page, collected: allReviews.length }, "SearchAPI rate limit hit mid-fetch — saving partial results");
      break;
    }
    if (!res.ok) {
      if (page === 0) throw new Error(`SearchAPI error ${res.status}`);
      logger.warn({ page, status: res.status }, "SearchAPI mid-fetch error — saving partial results");
      break;
    }

    const data = (await res.json()) as {
      // The google_maps_reviews engine never includes place_info — we get it separately.
      reviews?: Array<{
        rating: number;
        iso_date: string;
        text?: string;      // primary text field
        snippet?: string;   // fallback (older API versions)
        user?: { name?: string };
      }>;
      pagination?: { next_page_token?: string };
    };

    const pageReviews = (data.reviews ?? []).map((r) => ({
      rating: r.rating,
      isoDate: r.iso_date,
      text: r.text ?? r.snippet ?? "",
      author: r.user?.name ?? "Anonymous",
    }));

    allReviews.push(...pageReviews);
    nextPageToken = data.pagination?.next_page_token;
    page++;

    logger.info({ page, fetched: pageReviews.length, total: allReviews.length }, "SearchAPI page fetched");

    if (pageReviews.length === 0) break;
  } while (nextPageToken && page < maxPages);

  // Wait for the place info call that was running in parallel.
  const placeInfo = await placeInfoPromise;

  const recentReviews: RecentReview[] = allReviews.slice(0, 8).map((r) => ({
    rating: r.rating,
    isoDate: r.isoDate,
    text: r.text ?? "",
    author: r.author ?? "Anonymous",
  }));

  return {
    name: "",
    reviews: allReviews,
    recentReviews,
    totalFetched: allReviews.length,
    placeInfo,
    provider: "searchapi",
  };
}

/**
 * Apify: runs the compass/Google-Maps-Reviews-Scraper actor synchronously.
 * Uses the place_id URL format so the actor targets the exact listing.
 * Response is a flat array of review objects from the actor dataset.
 */
async function fetchFromApify(
  _googleMapsQuery: string,
  maxReviews = 100,
  key = CONFIG.providers.apify.apiKeys[0],
): Promise<LocationResult & { name: string }> {
  if (!key) throw Object.assign(new Error("APIFY_API_KEY not set"), { status: 0 });

  const placeId = process.env.PLACE_ID_ELTEX || "ChIJhTCaeeajpBIR4O9YniCqiJ0";
  const mapsUrl = `https://www.google.com/maps/place/?q=place_id:${placeId}`;

  type ApifyReviewItem = {
    reviewId?: string;
    reviewer?: { name?: string };
    stars?: number;
    publishedAtDate?: string;
    text?: string;
    totalScore?: number;
    reviewsCount?: number;
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5-min timeout

  let items: ApifyReviewItem[] = [];

  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/compass~Google-Maps-Reviews-Scraper/run-sync-get-dataset-items?token=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startUrls: [{ url: mapsUrl }],
          maxReviews,
          reviewsSort: "newest",
          language: "en",
          reviewsOrigin: "all",
          personalData: true,
        }),
        signal: controller.signal,
      },
    );

    if (res.status === 429 || res.status === 402) {
      const err: ProviderError = new Error(`Apify quota exceeded: ${res.status}`);
      err.status = res.status;
      throw err;
    }
    if (!res.ok) throw new Error(`Apify error ${res.status}: ${await res.text().catch(() => "")}`);

    items = (await res.json()) as ApifyReviewItem[];
  } finally {
    clearTimeout(timeout);
  }

  const allReviews: Review[] = items
    .filter((item) => item.stars != null && item.publishedAtDate)
    .map((item) => ({
      rating: item.stars!,
      isoDate: item.publishedAtDate!,
      text: item.text ?? "",
      author: item.reviewer?.name ?? "Anonymous",
    }));

  // totalScore and reviewsCount are the same on every item — grab from first
  const first = items[0];
  const googleTotalReviews = first?.reviewsCount ?? 0;
  const googleAvgRating = first?.totalScore ?? 0;

  const recentReviews: RecentReview[] = allReviews.slice(0, 8).map((r) => ({
    rating: r.rating,
    isoDate: r.isoDate,
    text: r.text ?? "",
    author: r.author ?? "Anonymous",
  }));

  logger.info(
    { fetched: allReviews.length, googleTotal: googleTotalReviews, googleAvg: googleAvgRating },
    "Apify reviews fetched",
  );

  return {
    name: "",
    reviews: allReviews,
    recentReviews,
    totalFetched: allReviews.length,
    placeInfo: { googleTotalReviews, googleAvgRating },
    provider: "apify",
  };
}

export async function fetchReviewsForLocation(
  locationName: string,
  googleMapsQuery: string,
  maxPages = 3,
): Promise<LocationResult> {
  // Provider priority: try each key for each provider before moving to the next.
  // 1a. SearchAPI primary key   — 100 calls/month, fast (~1s per page)
  // 1b. SearchAPI backup key    — same quota, separate account
  // 2a. Apify primary key       — pay-per-use, reliable fallback (~60-90s per run)
  // 2b. Apify backup key        — same behaviour, separate account
  const providers: Array<{ name: string; fn: () => Promise<LocationResult & { name: string }> }> = [
    ...CONFIG.providers.searchapi.apiKeys.map((key, i) => ({
      name: `searchapi-key${i + 1}`,
      fn: () => fetchFromSearchAPI(googleMapsQuery, maxPages, key),
    })),
    ...CONFIG.providers.apify.apiKeys.map((key, i) => ({
      name: `apify-key${i + 1}`,
      fn: () => fetchFromApify(googleMapsQuery, maxPages * 33, key),
    })),
  ];

  for (const provider of providers) {
    try {
      const result = await provider.fn();
      logger.info(
        {
          location: locationName,
          provider: provider.name,
          fetched: result.totalFetched,
          googleTotal: result.placeInfo.googleTotalReviews,
          googleAvg: result.placeInfo.googleAvgRating,
        },
        "Reviews fetched",
      );
      return { ...result, name: locationName };
    } catch (err) {
      const provErr = err as ProviderError;
      if (provErr.status === 429 || provErr.status === 403) {
        logger.warn({ provider: provider.name, location: locationName }, "Provider exhausted, trying next");
        continue;
      }
      logger.error({ err, provider: provider.name, location: locationName }, "Provider error, trying next");
      continue;
    }
  }

  logger.warn({ location: locationName }, "All providers exhausted, returning empty");
  return {
    name: locationName,
    reviews: [],
    recentReviews: [],
    totalFetched: 0,
    placeInfo: { googleTotalReviews: 0, googleAvgRating: 0 },
    provider: "exhausted",
  };
}

export function scoreReviews(
  reviews: Array<{ rating: number; isoDate: string }>,
  startDate: string,
  endDate: string,
  months: string[],
) {
  const start = new Date(startDate);
  const end = new Date(endDate + "T23:59:59.999Z");

  const monthlyMap: Record<string, { positive: number; negative: number }> = {};
  months.forEach((m) => (monthlyMap[m] = { positive: 0, negative: 0 }));

  let totalPositive = 0;
  let totalNegative = 0;

  for (const review of reviews) {
    const d = new Date(review.isoDate);
    if (d < start || d > end) continue;

    const monthName = d.toLocaleString("en-US", { month: "long" });
    if (review.rating >= 4) {
      totalPositive++;
      if (monthlyMap[monthName] !== undefined) monthlyMap[monthName].positive++;
    } else if (review.rating <= 2) {
      totalNegative++;
      if (monthlyMap[monthName] !== undefined) monthlyMap[monthName].negative++;
    }
  }

  const monthlyBreakdown = months.map((m) => ({
    month: m,
    positive: monthlyMap[m]?.positive ?? 0,
    negative: monthlyMap[m]?.negative ?? 0,
    net: (monthlyMap[m]?.positive ?? 0) - (monthlyMap[m]?.negative ?? 0),
  }));

  return { totalPositive, totalNegative, monthlyBreakdown };
}

export function scoreAllTime(reviews: Array<{ rating: number }>) {
  let positive = 0;
  let negative = 0;
  let ratingSum = 0;

  for (const r of reviews) {
    ratingSum += r.rating;
    if (r.rating >= 4) positive++;
    else if (r.rating <= 2) negative++;
  }

  const total = reviews.length;
  const avgRating = total > 0 ? Math.round((ratingSum / total) * 10) / 10 : 0;

  return { positive, negative, total, avgRating };
}
