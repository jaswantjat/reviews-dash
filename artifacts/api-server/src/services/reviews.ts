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

async function fetchFromHasData(_googleMapsQuery: string, maxPages = 3): Promise<LocationResult & { name: string }> {
  const key = CONFIG.providers.hasdata.apiKey;
  if (!key) throw Object.assign(new Error("HASDATA_API_KEY not set"), { status: 0 });

  // HasData requires placeId or dataId — not a text query
  const placeId = process.env.PLACE_ID_ELTEX || "ChIJhTCaeeajpBIR4O9YniCqiJ0";

  const allReviews: Review[] = [];
  let nextPageToken: string | undefined;
  let googleTotalReviews = 0;
  let googleAvgRating = 0;
  let page = 0;

  do {
    const params = new URLSearchParams({ placeId, sortBy: "newestFirst" });
    if (nextPageToken) params.set("nextPageToken", nextPageToken);

    const res = await fetch(
      `https://api.hasdata.com/scrape/google/maps-reviews?${params}`,
      { headers: { "x-api-key": key } },
    );

    if (res.status === 429 || res.status === 403) {
      const err: ProviderError = new Error(`HasData rate limit: ${res.status}`);
      err.status = res.status;
      throw err;
    }
    if (!res.ok) throw new Error(`HasData error ${res.status}`);

    const data = (await res.json()) as {
      placeInfo?: { reviews?: number; rating?: number };
      reviews?: Array<{ rating: number; isoDate: string; snippet?: string; text?: string; user?: { name?: string } }>;
      pagination?: { nextPageToken?: string };
    };

    if (page === 0 && data.placeInfo) {
      googleTotalReviews = data.placeInfo.reviews ?? 0;
      googleAvgRating = data.placeInfo.rating ?? 0;
    }

    const pageReviews = (data.reviews ?? []).map((r) => ({
      rating: r.rating,
      isoDate: r.isoDate,
      text: r.text ?? r.snippet ?? "",
      author: r.user?.name ?? "Anonymous",
    }));

    allReviews.push(...pageReviews);
    nextPageToken = data.pagination?.nextPageToken;
    page++;

    logger.info({ page, fetched: pageReviews.length, total: allReviews.length }, "HasData page fetched");

    if (pageReviews.length === 0) break;
  } while (nextPageToken && page < maxPages);

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
    placeInfo: { googleTotalReviews, googleAvgRating },
    provider: "hasdata",
  };
}

async function fetchFromSearchAPI(
  googleMapsQuery: string,
  maxPages = 3,
): Promise<LocationResult & { name: string }> {
  const key = CONFIG.providers.searchapi.apiKey;
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
async function fetchFromApify(_googleMapsQuery: string, maxReviews = 100): Promise<LocationResult & { name: string }> {
  const key = CONFIG.providers.apify.apiKey;
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

/**
 * ScrapingDog: fetch reviews directly via data_id (avoids the unreliable
 * text-search step which returns wrong places and fails with the field param).
 * API response shape: { locationDetails, reviews_results, pagination }
 */
async function fetchFromScrapingDog(_googleMapsQuery: string, maxPages = 3): Promise<LocationResult & { name: string }> {
  const key = CONFIG.providers.scrapingdog.apiKey;
  if (!key) throw Object.assign(new Error("SCRAPING_DOG_API_KEY not set"), { status: 0 });

  // The data_id is the hex representation of the Google Maps place.
  // Derived from place_id ChIJhTCaeeajpBIR4O9YniCqiJ0 via SearchAPI metadata.
  const dataId = process.env.DATA_ID_ELTEX || "0x12a4a3e6799a3085:0x9d88aa209e58efe0";

  const BASE_URL = "https://api.scrapingdog.com/google_maps/reviews";

  type ScrapingDogReview = {
    rating?: number;
    iso_date?: string;
    date?: string;
    snippet?: string;
    text?: string;
    user?: { name?: string };
  };

  type ScrapingDogResponse = {
    locationDetails?: { reviews?: number; rating?: number };
    reviews_results?: ScrapingDogReview[];
    pagination?: { next?: string; next_page_token?: string };
  };

  const allReviews: Review[] = [];
  let googleTotalReviews = 0;
  let googleAvgRating = 0;
  let nextPageToken: string | undefined;
  let page = 0;

  do {
    const params = new URLSearchParams({
      api_key: key,
      data_id: dataId,
      sort_by: "newest",
    });
    if (nextPageToken) params.set("next_page_token", nextPageToken);

    const res = await fetch(`${BASE_URL}?${params}`);

    if (res.status === 429 || res.status === 403) {
      if (page === 0) {
        const err: ProviderError = new Error(`ScrapingDog rate limit: ${res.status}`);
        err.status = res.status;
        throw err;
      }
      logger.warn({ page, collected: allReviews.length }, "ScrapingDog rate limit mid-fetch — saving partial results");
      break;
    }
    if (!res.ok) {
      if (page === 0) throw new Error(`ScrapingDog reviews error ${res.status}`);
      logger.warn({ page, status: res.status }, "ScrapingDog mid-fetch error — saving partial results");
      break;
    }

    const data = (await res.json()) as ScrapingDogResponse;

    if (page === 0) {
      googleTotalReviews = data.locationDetails?.reviews ?? 0;
      googleAvgRating = data.locationDetails?.rating ?? 0;
    }

    const pageReviews: Review[] = (data.reviews_results ?? [])
      .filter((r) => r.rating != null && (r.iso_date || r.date))
      .map((r) => ({
        rating: r.rating!,
        isoDate: r.iso_date ?? r.date ?? "",
        text: r.snippet ?? r.text ?? "",
        author: r.user?.name ?? "Anonymous",
      }));

    allReviews.push(...pageReviews);
    nextPageToken = data.pagination?.next_page_token;
    page++;

    logger.info({ page, fetched: pageReviews.length, total: allReviews.length, googleTotal: googleTotalReviews }, "ScrapingDog page fetched");

    if (pageReviews.length === 0) break;

    // Small delay between pages to be respectful to the API
    if (nextPageToken && page < maxPages) {
      await new Promise((r) => setTimeout(r, 500));
    }
  } while (nextPageToken && page < maxPages);

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
    placeInfo: { googleTotalReviews, googleAvgRating },
    provider: "scrapingdog",
  };
}

export async function fetchReviewsForLocation(
  locationName: string,
  googleMapsQuery: string,
  maxPages = 3,
): Promise<LocationResult> {
  // Provider priority:
  // 1. HasData     — 1,000 calls/month, highest quota, try first
  // 2. SearchAPI   — 100 calls/month, limited
  // 3. Apify       — pay-per-use (compass/Google-Maps-Reviews-Scraper), reliable fallback
  // 4. ScrapingDog — one-time credits, last resort
  const providers: Array<{ name: string; fn: () => Promise<LocationResult & { name: string }> }> = [
    { name: "hasdata", fn: () => fetchFromHasData(googleMapsQuery, maxPages) },
    { name: "searchapi", fn: () => fetchFromSearchAPI(googleMapsQuery, maxPages) },
    { name: "apify", fn: () => fetchFromApify(googleMapsQuery, maxPages * 33) }, // maxPages*33 ≈ reviews count
    { name: "scrapingdog", fn: () => fetchFromScrapingDog(googleMapsQuery, maxPages) },
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
  const end = new Date(endDate);

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
