import { CONFIG } from "../config.js";

export interface MonthStats {
  month: string;
  positive: number;
  negative: number;
  net: number;
}

export interface LocationStats {
  name: string;
  positive: number;
  negative: number;
  net: number;
}

export interface RecentReview {
  rating: number;
  isoDate: string;
  text: string;
  author: string;
}

export interface DashboardCache {
  netScore: number;
  positive: number;
  negative: number;
  objective: number;
  totalFetched: number;
  allTimePositive: number;
  allTimeNegative: number;
  allTimeTotal: number;
  allTimeAvgRating: number;
  googleTotalReviews: number;
  googleAvgRating: number;
  trimesterName: string;
  trimesterStart: string;
  trimesterEnd: string;
  monthlyBreakdown: MonthStats[];
  locationBreakdown: LocationStats[];
  recentActivity: RecentReview[];
  updatedAt: string;
  provider: string;
  cacheHit: boolean;
}

let reviewsCache: DashboardCache | null = null;
let lastReviewFetch = 0;

export function getReviewsCache() {
  return reviewsCache;
}

export function setReviewsCache(data: Omit<DashboardCache, "cacheHit">) {
  reviewsCache = { ...data, cacheHit: false };
  lastReviewFetch = Date.now();
}

export function isReviewCacheStale() {
  return Date.now() - lastReviewFetch > CONFIG.polling.reviewsIntervalMs;
}

export function buildEmptyDashboard(): DashboardCache {
  return {
    netScore: 0,
    positive: 0,
    negative: 0,
    objective: CONFIG.trimester.objective,
    totalFetched: 0,
    allTimePositive: 0,
    allTimeNegative: 0,
    allTimeTotal: 0,
    allTimeAvgRating: 0,
    googleTotalReviews: 0,
    googleAvgRating: 0,
    trimesterName: CONFIG.trimester.name,
    trimesterStart: CONFIG.trimester.startDate,
    trimesterEnd: CONFIG.trimester.endDate,
    monthlyBreakdown: CONFIG.trimester.months.map((m) => ({
      month: m,
      positive: 0,
      negative: 0,
      net: 0,
    })),
    locationBreakdown: CONFIG.locations.map((l) => ({
      name: l.name,
      positive: 0,
      negative: 0,
      net: 0,
    })),
    recentActivity: [],
    updatedAt: new Date().toISOString(),
    provider: "none",
    cacheHit: false,
  };
}
