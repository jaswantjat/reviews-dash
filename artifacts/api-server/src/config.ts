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
    scrapingdog: { apiKey: process.env.SCRAPING_DOG_API_KEY || "69c93a0dc12e078c544a57d8" },
    searchapi: { apiKey: process.env.SEARCHAPI_KEY || "2BcSHdpwMRps8xR611yFUaPW" },
    apify: { apiKey: process.env.APIFY_API_KEY || "apify_api_ijQwHpf6EaJleup32PTcgnZCzghs5F2wjHI7" },
  },
  polling: {
    // Poll external APIs every 45 minutes to stay within API quotas.
    // The SSE stream gives the browser real-time pushes; this interval only
    // controls how often we ask the external review providers for new data.
    reviewsIntervalMs: getPositiveIntEnv("REVIEWS_POLL_INTERVAL_MS", 45 * 60 * 1000),
    streamHeartbeatMs: getPositiveIntEnv("DASHBOARD_STREAM_HEARTBEAT_MS", 15 * 1000),
  },
};
