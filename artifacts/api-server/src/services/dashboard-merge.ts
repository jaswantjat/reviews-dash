import type { DashboardCache } from "./cache.js";

export type DashboardSnapshot = Omit<DashboardCache, "cacheHit">;

export const HARDCODED_UPDATED_AT = "2026-03-27T08:09:02Z";

export const HARDCODED_DASHBOARD: DashboardSnapshot = {
  netScore: 0,
  positive: 0,
  neutral: 0,
  negative: 0,
  objective: 270,
  trimesterName: "Q2 2026",
  trimesterStart: "2026-04-01",
  trimesterEnd: "2026-06-30",
  monthlyBreakdown: [
    { month: "April", positive: 0, negative: 0, net: 0 },
    { month: "May", positive: 0, negative: 0, net: 0 },
    { month: "June", positive: 0, negative: 0, net: 0 },
  ],
  locationBreakdown: [{ name: "Eltex", positive: 0, negative: 0, net: 0 }],
  totalFetched: 498,
  allTimePositive: 421,
  allTimeNegative: 74,
  allTimeTotal: 498,
  allTimeAvgRating: 4.4,
  googleTotalReviews: 897,
  googleAvgRating: 4.6,
  recentActivity: [
    {
      rating: 5,
      isoDate: "2026-03-27T08:09:02Z",
      text: "",
      author: "Sara Castaner",
    },
    {
      rating: 5,
      isoDate: "2026-03-26T22:20:37Z",
      text: "Contraté con Javier el comercial de Valencia y he qiedado muy satisfecho con la instalación y el trabajo realizado. Todo en tiempo y forma y muy profesional. Recomendable 100 x 100.",
      author: "Gamon Intermediacion, S.L.",
    },
    {
      rating: 4,
      isoDate: "2026-03-26T09:23:17Z",
      text: "Aunque el proceso se dilató más de lo esperado, el resultado final ha sido satisfactorio. Jordi (coordinador) y su equipo de instaladores hicieron un trabajo impecable. Un servicio técnico y de mediación excelente que compensa los tiempos de espera iniciales.",
      author: "mario solano",
    },
    {
      rating: 5,
      isoDate: "2026-03-25T21:38:05Z",
      text: "Muy contenta con la instalación, me ha gustado mucho como trabajan. Lo recomiendo lo hacen muy bien!!",
      author: "Lorena Rodriguez A.",
    },
    {
      rating: 5,
      isoDate: "2026-03-25T10:46:25Z",
      text: "El trato fue correcto, comercial e instalador, profesionales. Muy recomendable.",
      author: "DEPI FACIL DEPIFACIL",
    },
    {
      rating: 1,
      isoDate: "2026-03-25T09:22:16Z",
      text: "",
      author: "Ciudadano del mundo",
    },
    {
      rating: 5,
      isoDate: "2026-03-23T13:54:34Z",
      text: "",
      author: "tomas bordas tissier",
    },
    {
      rating: 5,
      isoDate: "2026-03-17T09:41:28Z",
      text: "",
      author: "Jorge velasco quintana",
    },
  ],
  updatedAt: HARDCODED_UPDATED_AT,
  provider: "baseline",
  openTickets: 0,
  oldestTicketDays: 0,
};

export function mergeDashboardData(dbData: DashboardSnapshot): DashboardSnapshot {
  const googleKnown =
    dbData.googleTotalReviews > 0
      ? dbData.googleTotalReviews
      : HARDCODED_DASHBOARD.googleTotalReviews;
  const minThreshold = Math.min(100, Math.floor(googleKnown * 0.2));
  const dbAllTimeReliable = dbData.allTimeTotal >= minThreshold;
  const dbHasData =
    dbData.allTimeTotal > 0 ||
    dbData.googleTotalReviews > 0 ||
    dbData.recentActivity.length > 0;

  return {
    ...HARDCODED_DASHBOARD,
    netScore: dbData.netScore,
    positive: dbData.positive,
    neutral: dbData.neutral,
    negative: dbData.negative,
    monthlyBreakdown: dbData.monthlyBreakdown,
    locationBreakdown: dbData.locationBreakdown,
    totalFetched: dbAllTimeReliable ? dbData.totalFetched : HARDCODED_DASHBOARD.totalFetched,
    allTimePositive: dbAllTimeReliable ? dbData.allTimePositive : HARDCODED_DASHBOARD.allTimePositive,
    allTimeNegative: dbAllTimeReliable ? dbData.allTimeNegative : HARDCODED_DASHBOARD.allTimeNegative,
    allTimeTotal: dbAllTimeReliable ? dbData.allTimeTotal : HARDCODED_DASHBOARD.allTimeTotal,
    allTimeAvgRating: dbAllTimeReliable ? dbData.allTimeAvgRating : HARDCODED_DASHBOARD.allTimeAvgRating,
    googleTotalReviews:
      dbData.googleTotalReviews > 0
        ? dbData.googleTotalReviews
        : HARDCODED_DASHBOARD.googleTotalReviews,
    googleAvgRating:
      dbData.googleAvgRating > 0
        ? dbData.googleAvgRating
        : HARDCODED_DASHBOARD.googleAvgRating,
    recentActivity:
      dbData.recentActivity.length > 0
        ? dbData.recentActivity
        : HARDCODED_DASHBOARD.recentActivity,
    openTickets: dbData.openTickets,
    oldestTicketDays: dbData.oldestTicketDays,
    updatedAt: dbHasData ? dbData.updatedAt : HARDCODED_DASHBOARD.updatedAt,
    provider: dbHasData ? "database" : HARDCODED_DASHBOARD.provider,
  };
}
