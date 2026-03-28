import { defineConfig } from "drizzle-kit";
import path from "path";

const SUPABASE_DB_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:AG16XvYgZgaNKkMS@db.nvrfoxhwfmierjmkwttt.supabase.co:5432/postgres";

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: SUPABASE_DB_URL,
  },
});
