-- ============================================================
-- Eltex Reviews Dashboard — Supabase Database Setup
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard)
-- Project: nvrfoxhwfmierjmkwttt
-- ============================================================

-- 1. Create the reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
  id              TEXT PRIMARY KEY,
  place_id        TEXT NOT NULL,
  location_name   TEXT NOT NULL,
  rating          INTEGER NOT NULL,
  iso_date        TEXT NOT NULL,
  review_text     TEXT DEFAULT '',
  author          TEXT DEFAULT 'Anonymous',
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create the place_meta table
CREATE TABLE IF NOT EXISTS public.place_meta (
  place_id              TEXT PRIMARY KEY,
  location_name         TEXT NOT NULL,
  google_total_reviews  INTEGER NOT NULL DEFAULT 0,
  google_avg_rating_x10 INTEGER NOT NULL DEFAULT 0,
  last_seeded_at        TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Enable Row Level Security (but allow all operations for the publishable key)
ALTER TABLE public.reviews    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_meta ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies — allow full access via the publishable (anon) key
--    (data is non-sensitive; this is a read-only TV dashboard)
DROP POLICY IF EXISTS "Allow all for anon"  ON public.reviews;
DROP POLICY IF EXISTS "Allow all for anon"  ON public.place_meta;

CREATE POLICY "Allow all for anon" ON public.reviews
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for anon" ON public.place_meta
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- 5. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS reviews_place_id_idx    ON public.reviews (place_id);
CREATE INDEX IF NOT EXISTS reviews_iso_date_idx    ON public.reviews (iso_date);
CREATE INDEX IF NOT EXISTS reviews_rating_idx      ON public.reviews (rating);

-- Done! You can now call POST /dashboard/seed to populate the DB,
-- then POST /dashboard/push-to-supabase to replicate data here.
SELECT 'Setup complete' AS status;
