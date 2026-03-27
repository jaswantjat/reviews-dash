import { db, reviewsTable, placeMetaTable } from "@workspace/db";
import { eq, desc, count, sql } from "drizzle-orm";
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

export async function upsertReviews(reviews: InsertReviewInput[]): Promise<number> {
  if (reviews.length === 0) return 0;
  let upserted = 0;
  const CHUNK = 100;
  for (let i = 0; i < reviews.length; i += CHUNK) {
    const chunk = reviews.slice(i, i + CHUNK);
    await db
      .insert(reviewsTable)
      .values(chunk)
      .onConflictDoUpdate({
        target: reviewsTable.id,
        // On conflict, update text and rating so re-seeding can fix previously
        // empty review_text values (e.g. when the field mapping was wrong).
        set: {
          reviewText: sql`EXCLUDED.review_text`,
          rating: sql`EXCLUDED.rating`,
        },
      });
    upserted += chunk.length;
  }
  logger.info({ count: upserted }, "Reviews upserted to DB");
  return upserted;
}

export async function getAllReviewsForPlace(placeId: string) {
  return db
    .select()
    .from(reviewsTable)
    .where(eq(reviewsTable.placeId, placeId))
    .orderBy(desc(reviewsTable.isoDate));
}

export async function getRecentReviewsForPlace(placeId: string, limit = 8) {
  return db
    .select()
    .from(reviewsTable)
    .where(eq(reviewsTable.placeId, placeId))
    .orderBy(desc(reviewsTable.isoDate))
    .limit(limit);
}

export async function upsertPlaceMeta(
  placeId: string,
  locationName: string,
  googleTotalReviews: number,
  googleAvgRating: number,
  isSeeding = false,
) {
  const now = new Date();
  await db
    .insert(placeMetaTable)
    .values({
      placeId,
      locationName,
      googleTotalReviews,
      googleAvgRating: Math.round(googleAvgRating * 10),
      lastSeededAt: isSeeding ? now : undefined,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: placeMetaTable.placeId,
      set: {
        googleTotalReviews,
        googleAvgRating: Math.round(googleAvgRating * 10),
        ...(isSeeding ? { lastSeededAt: now } : {}),
        updatedAt: now,
      },
    });
}

export async function getPlaceMeta(placeId: string) {
  const rows = await db
    .select()
    .from(placeMetaTable)
    .where(eq(placeMetaTable.placeId, placeId));
  return rows[0] ?? null;
}

export async function countAllReviews(): Promise<number> {
  const rows = await db.select({ value: count() }).from(reviewsTable);
  return rows[0]?.value ?? 0;
}
