import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const SUPABASE_DB_URL =
  process.env.SUPABASE_DATABASE_URL ||
  "postgresql://postgres:AG16XvYgZgaNKkMS@db.nvrfoxhwfmierjmkwttt.supabase.co:5432/postgres";

export const pool = new Pool({ connectionString: SUPABASE_DB_URL });
export const db = drizzle(pool, { schema });

export * from "./schema";
