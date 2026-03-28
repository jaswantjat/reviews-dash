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
    hasdata: { apiKey: process.env.HASDATA_API_KEY || "c7d8134a-3e82-45db-b8d4-ed252eec9261" },
    scrapingdog: { apiKey: process.env.SCRAPING_DOG_API_KEY || "698f2629379cb7c9af68083c" },
    searchapi: { apiKey: process.env.SEARCHAPI_KEY || "AgRaiEz8Zcg5NdZq6g6o4bJK" },
  },
  polling: {
    // Real-time sync: check for new reviews every 2 minutes
    reviewsIntervalMs: getPositiveIntEnv("REVIEWS_POLL_INTERVAL_MS", 2 * 60 * 1000),
    streamHeartbeatMs: getPositiveIntEnv("DASHBOARD_STREAM_HEARTBEAT_MS", 15 * 1000),
  },
};
