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
    searchapi: { apiKey: process.env.SEARCHAPI_KEY || "2BcSHdpwMRps8xR611yFUaPW" },
    apify: { apiKey: process.env.APIFY_API_KEY || "apify_api_ijQwHpf6EaJleup32PTcgnZCzghs5F2wjHI7" },
  },
  polling: {
    // Fetch new reviews once per day at this UTC hour (default: 06:00 UTC).
    // Override with POLL_HOUR_UTC env var (0–23).
    pollHourUtc: getPositiveIntEnv("POLL_HOUR_UTC", 6),
    streamHeartbeatMs: getPositiveIntEnv("DASHBOARD_STREAM_HEARTBEAT_MS", 45 * 60 * 1000),
  },
};
