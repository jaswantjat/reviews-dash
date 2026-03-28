import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://nvrfoxhwfmierjmkwttt.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_cdPsgk5Rtz4y98BQ0ubniQ_QywlLeMZ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
