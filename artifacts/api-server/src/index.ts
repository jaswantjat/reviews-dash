import app from "./app";
import { logger } from "./lib/logger";
import { countAllReviews } from "./services/reviews-db";
import { startPolling, startKeepAlive } from "./services/poller";
import { buildMergedDashboard } from "./routes/dashboard";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Run startup tasks in the background — do not block the server from serving.
  runStartupTasks(port).catch((e) =>
    logger.error({ err: e }, "Startup tasks failed"),
  );
});

async function runStartupTasks(port: number) {
  // Check whether the database already has reviews.
  // If empty (fresh environment / first boot), run a full seed so the
  // dashboard is immediately useful without manual intervention.
  try {
    const existingCount = await countAllReviews();

    if (existingCount === 0) {
      logger.info("Database is empty — running auto-seed to populate reviews");
      const res = await fetch(`http://localhost:${port}/api/dashboard/seed`, {
        method: "POST",
      });
      const body = (await res.json()) as {
        success: boolean;
        results?: Array<{ location: string; fetched: number }>;
      };

      if (body.success) {
        const total = body.results?.reduce((s, r) => s + r.fetched, 0) ?? 0;
        logger.info({ total }, "Auto-seed complete");
      } else {
        logger.warn(body, "Auto-seed returned non-success");
      }
    } else {
      logger.info({ existingCount }, "Database already has reviews — skipping auto-seed");
    }
  } catch (err) {
    // Non-fatal: if seeding fails the server still works; user can seed manually.
    logger.error({ err }, "Auto-seed failed — server continues normally");
  }

  // Start the background polling loop that refreshes reviews every 45 minutes.
  startPolling(buildMergedDashboard);

  // Keep Supabase free-tier alive — pings the DB every 12 hours.
  startKeepAlive();
}
