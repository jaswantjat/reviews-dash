import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://nvrfoxhwfmierjmkwttt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_cdPsgk5Rtz4y98BQ0ubniQ_QywlLeMZ";
const SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52cmZveGh3Zm1pZXJqbWt3dHR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDcyNjc5NSwiZXhwIjoyMDkwMzAyNzk1fQ.JYPt6QR37CJVyCZ-uyBTq4A5pVA5s_m_KPDYcoDUYSM";

export const SUPABASE_PROJECT_URL = SUPABASE_URL;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

export const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

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
    const { error, count } = await supabaseAdmin
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
  const { error } = await supabaseAdmin
    .from("place_meta")
    .upsert(meta, { onConflict: "place_id" });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
