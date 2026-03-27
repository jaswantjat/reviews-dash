function getPositiveIntEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;

  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const CONFIG = {
  trimester: {
    name: "Q2 2026",
    startDate: "2026-04-01",
    endDate: "2026-06-30",
    objective: 270,
    months: ["April", "May", "June"],
  },
  locations: [
    {
      name: "Eltex",
      // Maps search query used to find the business and fetch reviews
      googleMapsQuery: "Eltex solar España",
    },
  ],
  providers: {
    hasdata: { apiKey: process.env.HASDATA_API_KEY || "758beeec-cae2-45b8-a41e-d7aec5769868" },
    scrapingdog: { apiKey: process.env.SCRAPING_DOG_API_KEY || "698f2629379cb7c9af68083c" },
    searchapi: { apiKey: process.env.SEARCHAPI_KEY || "PrJHcyjwWTiXxM9k9mPbzQZA" },
  },
  polling: {
    // Real-time sync: check for new reviews every 2 minutes
    reviewsIntervalMs: getPositiveIntEnv("REVIEWS_POLL_INTERVAL_MS", 2 * 60 * 1000),
    streamHeartbeatMs: getPositiveIntEnv("DASHBOARD_STREAM_HEARTBEAT_MS", 15 * 1000),
  },
};
