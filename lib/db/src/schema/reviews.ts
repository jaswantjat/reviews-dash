import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reviewsTable = pgTable("reviews", {
  id: text("id").primaryKey(),
  placeId: text("place_id").notNull(),
  locationName: text("location_name").notNull(),
  rating: integer("rating").notNull(),
  isoDate: text("iso_date").notNull(),
  reviewText: text("review_text").default(""),
  author: text("author").default("Anonymous"),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
});

export const insertReviewSchema = createInsertSchema(reviewsTable).omit({ fetchedAt: true });
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviewsTable.$inferSelect;

export const placeMetaTable = pgTable("place_meta", {
  placeId: text("place_id").primaryKey(),
  locationName: text("location_name").notNull(),
  googleTotalReviews: integer("google_total_reviews").default(0).notNull(),
  googleAvgRating: integer("google_avg_rating_x10").default(0).notNull(),
  lastSeededAt: timestamp("last_seeded_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PlaceMeta = typeof placeMetaTable.$inferSelect;
