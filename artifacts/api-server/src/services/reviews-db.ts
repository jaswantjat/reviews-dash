import { supabaseAdmin } from "@workspace/db/supabase";
import { logger } from "../lib/logger.js";

export type InsertReviewInput = {
  id: string;
  placeId: string;
  locationName: string;
  rating: number;
  isoDate: string;
  reviewText: string;
  author: string;
};

function toRow(r: InsertReviewInput) {
  return {
    id: r.id,
    place_id: r.placeId,
    location_name: r.locationName,
    rating: r.rating,
    iso_date: r.isoDate,
    review_text: r.reviewText,
    author: r.author,
  };
}

export async function upsertReviews(reviews: InsertReviewInput[]): Promise<number> {
  if (reviews.length === 0) return 0;
  let upserted = 0;
  const CHUNK = 100;
  for (let i = 0; i < reviews.length; i += CHUNK) {
    const chunk = reviews.slice(i, i + CHUNK).map(toRow);
    const { error, count } = await supabaseAdmin
      .from("reviews")
      .upsert(chunk, { onConflict: "id", count: "exact" });
    if (error) {
      logger.error({ error: error.message }, "Failed to upsert reviews chunk");
    } else {
      upserted += count ?? chunk.length;
    }
  }
  logger.info({ count: upserted }, "Reviews upserted to DB");
  return upserted;
}

export async function getAllReviewsForPlace(placeId: string) {
  const { data, error } = await supabaseAdmin
    .from("reviews")
    .select("*")
    .eq("place_id", placeId)
    .order("iso_date", { ascending: false });
  if (error) {
    logger.error({ error: error.message }, "getAllReviewsForPlace failed");
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    placeId: r.place_id,
    locationName: r.location_name,
    rating: r.rating,
    isoDate: r.iso_date,
    reviewText: r.review_text,
    author: r.author,
    fetchedAt: new Date(),
  }));
}

export async function getRecentReviewsForPlace(placeId: string, limit = 8) {
  const { data, error } = await supabaseAdmin
    .from("reviews")
    .select("*")
    .eq("place_id", placeId)
    .order("iso_date", { ascending: false })
    .limit(limit);
  if (error) {
    logger.error({ error: error.message }, "getRecentReviewsForPlace failed");
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    placeId: r.place_id,
    locationName: r.location_name,
    rating: r.rating,
    isoDate: r.iso_date,
    reviewText: r.review_text,
    author: r.author,
    fetchedAt: new Date(),
  }));
}

export async function upsertPlaceMeta(
  placeId: string,
  locationName: string,
  googleTotalReviews: number,
  googleAvgRating: number,
  isSeeding = false,
) {
  const now = new Date().toISOString();
  const row: Record<string, unknown> = {
    place_id: placeId,
    location_name: locationName,
    google_total_reviews: googleTotalReviews,
    google_avg_rating_x10: Math.round(googleAvgRating * 10),
    updated_at: now,
  };
  if (isSeeding) row.last_seeded_at = now;

  const { error } = await supabaseAdmin
    .from("place_meta")
    .upsert(row, { onConflict: "place_id" });

  if (error) {
    logger.error({ error: error.message }, "upsertPlaceMeta failed");
  }
}

export async function getPlaceMeta(placeId: string) {
  const { data, error } = await supabaseAdmin
    .from("place_meta")
    .select("*")
    .eq("place_id", placeId)
    .maybeSingle();
  if (error) {
    logger.error({ error: error.message }, "getPlaceMeta failed");
    return null;
  }
  if (!data) return null;
  return {
    placeId: data.place_id,
    locationName: data.location_name,
    googleTotalReviews: data.google_total_reviews,
    googleAvgRating: data.google_avg_rating_x10,
    lastSeededAt: data.last_seeded_at ? new Date(data.last_seeded_at) : null,
    updatedAt: new Date(data.updated_at),
  };
}

export async function countAllReviews(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("reviews")
    .select("*", { count: "exact", head: true });
  if (error) {
    logger.error({ error: error.message }, "countAllReviews failed");
    return 0;
  }
  return count ?? 0;
}
