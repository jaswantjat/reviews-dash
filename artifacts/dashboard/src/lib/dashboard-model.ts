export interface RecentReview {
  rating: number;
  isoDate: string;
  text: string;
  author: string;
}

export interface DashboardData {
  netScore: number;
  positive: number;
  neutral: number;
  negative: number;
  objective: number;
  allTimePositive: number;
  allTimeNegative: number;
  allTimeTotal: number;
  googleTotalReviews: number;
  googleAvgRating: number;
  trimesterName: string;
  trimesterStart: string;
  trimesterEnd: string;
  recentActivity: RecentReview[];
}

export interface ReviewCardItem {
  id: number;
  name: string;
  ini: string;
  hue: number;
  sat: string;
  lit: string;
  r: number;
  t: string;
  txt: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function nameToHue(name: string): number {
  let hue = 0;
  for (let index = 0; index < name.length; index++) {
    hue = (hue * 31 + name.charCodeAt(index)) & 0xffffffff;
  }
  return Math.abs(hue) % 360;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function timeAgoES(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 2) return "ahora mismo";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "hace 1 día";
  if (diffDays < 30) return `hace ${diffDays} días`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 6) return `hace ${diffWeeks} semanas`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return "hace 1 mes";
  return `hace ${diffMonths} meses`;
}

export function daysRemaining(endDate: string): number {
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diff = Math.ceil((end.getTime() - today.getTime()) / 86400000);
  return Math.max(0, diff);
}

export function daysUntilStart(startDate: string): number {
  const start = new Date(startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  const diff = Math.ceil((start.getTime() - today.getTime()) / 86400000);
  return Math.max(0, diff);
}

export function formatStartDate(isoDate: string): string {
  const monthLabels = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  const date = new Date(isoDate);
  return `${date.getDate()} ${monthLabels[date.getMonth()]}`;
}

export function quarterRange(start: string, end: string): string {
  const monthLabels = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  const startDate = new Date(start);
  const endDate = new Date(end);
  return `${monthLabels[startDate.getMonth()]} – ${monthLabels[endDate.getMonth()]} ${endDate.getFullYear()}`;
}

function normalizeDate(isoDate: string): string {
  return isoDate.replace(/\.\d+Z$/, "Z");
}

export function getChallengeSentimentStats(data: DashboardData | null | undefined) {
  return {
    positive: data?.positive ?? 0,
    neutral: data?.neutral ?? 0,
    negative: data?.negative ?? 0,
  };
}

export function toReviewCards(reviews: RecentReview[]): ReviewCardItem[] {
  const seen = new Map<string, RecentReview>();

  for (const review of reviews) {
    const key = `${normalizeDate(review.isoDate)}::${review.rating}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, review);
      continue;
    }

    const existingIsAnon = !existing.author || existing.author === "Anonymous";
    const reviewIsAnon = !review.author || review.author === "Anonymous";
    if (existingIsAnon && !reviewIsAnon) {
      seen.set(key, review);
      continue;
    }

    if (!existing.text?.trim() && review.text?.trim()) {
      seen.set(key, review);
    }
  }

  return Array.from(seen.values())
    .filter((review) => {
      const isAnon = !review.author || review.author === "Anonymous";
      return !isAnon || Boolean(review.text?.trim());
    })
    .map((review, index) => {
      const hue = nameToHue(review.author);
      const sat = 55 + (hue % 20);
      const lit = 38 + (hue % 20);
      return {
        id: index,
        name: review.author,
        ini: initials(review.author),
        hue,
        sat: `${sat}%`,
        lit: `${lit}%`,
        r: review.rating,
        t: timeAgoES(review.isoDate),
        txt: stripHtml(review.text) || "Sin texto de reseña.",
      };
    });
}
