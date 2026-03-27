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
      placeId: process.env.PLACE_ID_ELTEX || "",
      // Used by the google_maps engine to look up the real total review count
      // and official rating, which the reviews endpoint doesn't provide.
      googleMapsQuery: process.env.GOOGLE_MAPS_QUERY_ELTEX || "Eltex solar España",
    },
  ],
  providers: {
    hasdata: { apiKey: process.env.HASDATA_API_KEY || "" },
    scrapingdog: { apiKey: process.env.SCRAPING_DOG_API_KEY || "" },
    searchapi: { apiKey: process.env.SEARCHAPI_KEY || "" },
  },
  polling: {
    reviewsIntervalMs: 45 * 60 * 1000,
  },
};
