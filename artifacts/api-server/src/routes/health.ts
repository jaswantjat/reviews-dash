import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { supabaseAdmin } from "@workspace/db/supabase";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  let dbOk = false;
  let dbLatencyMs = 0;

  try {
    const t0 = Date.now();
    const { error } = await supabaseAdmin
      .from("place_meta")
      .select("place_id")
      .limit(1);
    dbLatencyMs = Date.now() - t0;
    if (error) throw new Error(error.message);
    dbOk = true;
  } catch (err) {
    logger.warn({ err }, "/healthz db check failed");
  }

  const status = dbOk ? "ok" : "degraded";
  const data = HealthCheckResponse.parse({ status });

  res.status(dbOk ? 200 : 503).json({
    ...data,
    db: dbOk ? "ok" : "error",
    dbLatencyMs,
    timestamp: new Date().toISOString(),
  });
});

export default router;
