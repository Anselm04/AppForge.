import { Router, Request, Response } from "express";
import { db } from "../db.js";
import { sql } from "drizzle-orm";
import { summarizeTeamIntegrations } from "../config/teamIntegrations.js";
import { logger } from "../_core/logger.js";
import { getStartupReadiness } from "../services/startupState.js";
import { checkSharedRedis } from "../middleware/rateLimiter.js";
import { createSignupConfirmation } from "../services/authEmailDelivery.js";
import {
  incrementOperationalMetric,
  setOperationalGauge,
  startOperationalTrace,
} from "../lib/operationsObservability.js";

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
  const startup = getStartupReadiness();
  const health = {
    status: startup.ready ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: "unknown",
    redis: process.env.NODE_ENV === "production" ? "unknown" : "not-required",
    startup: startup.phase,
    version: process.env.npm_package_version ?? "unknown",
    environment: process.env.NODE_ENV ?? "unknown",
  };

  const databaseTrace = startOperationalTrace({
    component: "database",
    operation: "health_probe",
  });
  try {
    await db.execute(sql`SELECT 1`);
    health.database = "connected";
    databaseTrace.end("ok");
    setOperationalGauge("appforge_database_connected", 1);
  } catch (error) {
    databaseTrace.end("error");
    incrementOperationalMetric("appforge_database_errors_total", {
      operation: "health_probe",
    });
    setOperationalGauge("appforge_database_connected", 0);
    health.status = "degraded";
    health.database = "disconnected";
    logger.error({ error }, "health_database_check_failed");
  }

  if (process.env.NODE_ENV === "production") {
    const redisReady = await checkSharedRedis();
    health.redis = redisReady ? "connected" : "disconnected";
    setOperationalGauge("appforge_redis_connected", redisReady ? 1 : 0);
    if (!redisReady) {
      incrementOperationalMetric("appforge_redis_errors_total", {
        operation: "health_probe",
      });
      health.status = "degraded";
    }
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
  const startup = getStartupReadiness();
  if (!startup.ready) {
    return res.status(503).json({
      status: "degraded",
      ready: false,
      reason: startup.reason || startup.phase,
    });
  }

  try {
    await db.execute(sql`SELECT 1`);
    setOperationalGauge("appforge_database_connected", 1);
  } catch (error) {
    setOperationalGauge("appforge_database_connected", 0);
    logger.error({ error }, "readiness_database_check_failed");
    return res
      .status(503)
      .json({ status: "degraded", ready: false, reason: "database" });
  }

  if (process.env.NODE_ENV === "production") {
    const redisReady = await checkSharedRedis();
    setOperationalGauge("appforge_redis_connected", redisReady ? 1 : 0);
    if (!redisReady) {
      logger.error({}, "readiness_redis_check_failed");
      return res
        .status(503)
        .json({ status: "degraded", ready: false, reason: "redis" });
    }
  }

  return res.status(200).json({ status: "ok", ready: true });
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

function safeNext(value: unknown): string {
  if (typeof value !== "string") return "/";
  return value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
    ? value
    : "/";
}

// Public signup confirmation delivery lives on the only pre-authenticated API
// router in the current server composition. CSRF/global abuse controls still run
// before this router. The endpoint itself fails closed unless startup readiness,
// Supabase service-role link generation and Twilio delivery all succeed.
router.post("/auth-signup", async (req: Request, res: Response) => {
  setNoStoreHeaders(res);
  const startup = getStartupReadiness();
  if (!startup.ready) {
    return res.status(503).json({
      error: "Service temporarily unavailable",
      code: "STARTUP_NOT_READY",
    });
  }

  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";
  const next = safeNext(req.body?.next);

  if (!email || !email.includes("@") || password.length < 8) {
    return res.status(400).json({
      error: "A valid email and password of at least 8 characters are required.",
      code: "INVALID_SIGNUP_INPUT",
    });
  }

  const origin = `${req.protocol}://${req.get("host")}`;
  const redirectTo = `${origin}/login?next=${encodeURIComponent(next)}`;

  try {
    const result = await createSignupConfirmation({
      email,
      password,
      redirectTo,
    });
    return res.status(202).json({
      user: { id: result.userId, email },
      confirmationSent: true,
    });
  } catch (error) {
    logger.error({ error }, "signup_confirmation_delivery_failed");
    incrementOperationalMetric(
      "appforge_auth_confirmation_delivery_failures_total",
    );
    return res.status(503).json({
      error:
        "We could not send your confirmation email. Please try again shortly.",
      code: "CONFIRMATION_DELIVERY_FAILED",
    });
  }
});

export default router;

export const healthRouter = router;
