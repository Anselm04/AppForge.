import { Router, Request, Response } from "express";
import { db } from "../db.js";
import { sql } from "drizzle-orm";
import { summarizeTeamIntegrations } from "../config/teamIntegrations.js";
import { logger } from "../_core/logger.js";

const router = Router();

function setNoStoreHeaders(res: Response) {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

router.get("/", async (_req: Request, res: Response) => {
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: "unknown",
    version: process.env.npm_package_version ?? "unknown",
    environment: process.env.NODE_ENV ?? "unknown",
  };

  try {
    await db.execute(sql`SELECT 1`);
    health.database = "connected";
  } catch (error) {
    health.status = "degraded";
    health.database = "disconnected";
    logger.error({ error }, "health_database_check_failed");
  }

  const statusCode = health.status === "ok" ? 200 : 503;
  setNoStoreHeaders(res);
  return res.status(statusCode).json(health);
});

router.get("/live", (_req: Request, res: Response) => {
  setNoStoreHeaders(res);
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

router.get("/ready", async (_req: Request, res: Response) => {
  setNoStoreHeaders(res);
  try {
    await db.execute(sql`SELECT 1`);
    res.status(200).json({ status: "ok", ready: true });
  } catch (error) {
    logger.error({ error }, "readiness_database_check_failed");
    res
      .status(503)
      .json({ status: "degraded", ready: false, reason: "database" });
  }
});

// Keep the public readiness endpoint deliberately coarse in production. The
// old response exposed which security/communications/monitoring integrations
// were configured, giving unauthenticated callers a useful map of deployment
// gaps. Detailed integration status belongs behind the authenticated admin UI.
router.get("/integrations", (_req: Request, res: Response) => {
  const summary = summarizeTeamIntegrations();
  setNoStoreHeaders(res);

  if (process.env.NODE_ENV === "production") {
    return res.status(summary.productionReady ? 200 : 503).json({
      status: summary.productionReady ? "configured" : "incomplete",
      productionReady: summary.productionReady,
    });
  }

  return res.status(200).json({
    status: summary.productionReady ? "configured" : "incomplete",
    configured: summary.configured,
    required: summary.required,
    productionReady: summary.productionReady,
    integrations: summary.integrations,
  });
});

export default router;

export const healthRouter = router;
