import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://nvrfoxhwfmierjmkwttt.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_cdPsgk5Rtz4y98BQ0ubniQ_QywlLeMZ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export type SupabaseReview = {
  id: string;
  place_id: string;
  location_name: string;
  rating: number;
  iso_date: string;
  review_text: string;
  author: string;
};

export type SupabasePlaceMeta = {
  place_id: string;
  location_name: string;
  google_total_reviews: number;
  google_avg_rating_x10: number;
  last_seeded_at: string | null;
  updated_at: string;
};

export async function pushReviewsToSupabase(
  reviews: SupabaseReview[],
): Promise<{ inserted: number; errors: number; lastError?: string }> {
  if (reviews.length === 0) return { inserted: 0, errors: 0 };

  const CHUNK = 200;
  let inserted = 0;
  let errors = 0;
  let lastError: string | undefined;

  for (let i = 0; i < reviews.length; i += CHUNK) {
    const chunk = reviews.slice(i, i + CHUNK);
    const { error, count } = await supabase
      .from("reviews")
      .upsert(chunk, { onConflict: "id", count: "exact" });

    if (error) {
      errors++;
      lastError = error.message;
    } else {
      inserted += count ?? chunk.length;
    }
  }

  return { inserted, errors, lastError };
}

export async function pushPlaceMetaToSupabase(
  meta: SupabasePlaceMeta,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("place_meta")
    .upsert(meta, { onConflict: "place_id" });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
