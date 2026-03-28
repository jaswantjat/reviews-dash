import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Priority:
// 1. SUPABASE_DATABASE_URL — explicit Supabase Postgres URL (set in Railway/prod)
// 2. DATABASE_URL — Replit's built-in Postgres (dev) or Railway DB URL
// 3. Hardcoded Supabase URL — last-resort fallback for Railway deployment
const DB_URL =
  process.env.SUPABASE_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://postgres:AG16XvYgZgaNKkMS@db.nvrfoxhwfmierjmkwttt.supabase.co:5432/postgres";

export const pool = new Pool({ connectionString: DB_URL });
export const db = drizzle(pool, { schema });

export * from "./schema";
