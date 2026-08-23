import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers/index.js";
import { createContext } from "./_core/context.js";
import { stripeWebhookHandler } from "./webhooks/stripe.js";
import { ENV } from "./_core/env.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import * as Sentry from "@sentry/node";
import { securityHeaders } from "./middleware/securityHeaders.js";
import { compressionMiddleware } from "./middleware/compression.js";
import { createRateLimiter } from "./middleware/rateLimiter.js";
import { createSlowDown } from "./middleware/slowDown.js";
import { sentryErrorHandler, sentryRequestLogging } from "./middleware/sentryHandler.js";
import { healthRouter } from "./routes/health.js";
import { aiRouter } from "./routes/ai.js";
import { agentsRouter } from "./routes/agents.js";
import { buildRouter } from "./routes/build.js";
import { checkoutRouter } from "./routes/checkout.js";
import { supabaseAuthMiddleware } from "./middleware/supabaseAuth.js";
import { closeDbConnection } from "./db.js";
import { logger } from "./_core/logger.js";
import { AppError } from "./utils/errorReporting.js";

const app = express();
const PORT = process.env.PORT || 3000;
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT_MS || "30000", 10);

// ── Sentry initialization (before middleware) ──
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",
  release: process.env.npm_package_version,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
});

// ── Trust proxy when behind ALB / Cloudflare ──
if (ENV.isProduction) {
  app.set("trust proxy", 1);
}

// ── SSL/HTTPS enforcement (production only) ──
if (ENV.isProduction) {
  app.use((req, res, next) => {
    // req.secure may be false behind ALB; check x-forwarded-proto
    const proto = req.headers["x-forwarded-proto"] as string | undefined;
    const isHttps = req.secure || proto === "https";
    if (!isHttps) {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// ── Security & compression ──
app.use(securityHeaders());
app.use(cors({
  origin: process.env.CORS_ORIGIN || (ENV.isProduction ? false : true),
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key", "stripe-signature"],
}));
app.use(compressionMiddleware());

// ── Request logging (Sentry + structured logger) ──
app.use(sentryRequestLogging());
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: duration,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      userId: (req as any).user?.id ?? null,
    }, "http_request");
  });
  next();
});

// ── Request timeout middleware ──
app.use((req, res, next) => {
  req.setTimeout(REQUEST_TIMEOUT, () => {
    if (!res.headersSent) {
      res.status(408).json({ error: "Request timeout" });
    }
  });
  res.setTimeout(REQUEST_TIMEOUT);
  next();
});

// ── Body parsing (after raw body route) ──
app.use(cookieParser(ENV.cookieSecret));

// ── Rate limiting: strict for webhooks ──
(async () => {
  const webhookLimiter = await createRateLimiter({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60,                 // 60 webhook events per minute
    message: "Webhook rate limit exceeded. Please retry with exponential backoff.",
  });
  app.use("/api/webhooks/stripe", webhookLimiter);
})().catch(() => {});

// Stripe webhook (raw body required — before JSON parser)
app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), stripeWebhookHandler);

// ── Global middleware ──
app.use(express.json({ limit: "10mb" }));

// ── Rate limiting: global + API ──
(async () => {
  const globalLimiter = await createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300,
    message: "Too many requests, please try again later.",
  });
  const apiLimiter = await createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: "API rate limit exceeded, please slow down.",
  });
  const buildLimiter = await createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    message: "Build rate limit exceeded. Please wait before creating more builds.",
  });
  const slowDown = createSlowDown({
    windowMs: 15 * 60 * 1000,
    delayAfter: 50,
    maxDelayMs: 15 * 1000,
    message: "Too many requests, responses are being delayed.",
  });

  app.use(globalLimiter);
  app.use(slowDown);
  app.use("/api/trpc/projects.create", buildLimiter);
  app.use("/api/trpc", apiLimiter);
})().catch(() => {});

// ── Health check (with DB verification) ──
app.use("/api/health", healthRouter);

// ── Auth middleware (sets req.user for all protected routes below) ──
app.use("/api", supabaseAuthMiddleware);
app.use("/api/trpc", supabaseAuthMiddleware);

// ── REST API routes ──
app.use("/api/ai", aiRouter);
app.use("/api/agents", agentsRouter);
app.use("/api/build", buildRouter);
app.use("/api/checkout", supabaseAuthMiddleware, checkoutRouter);

// ── tRPC routes ──
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// ── SPA fallback (React Router) ──
if (ENV.isProduction) {
  app.get("*", (req, res) => {
    res.sendFile("index.html", { root: "./dist" });
  });
}

// ── 404 handler ──
app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.path });
});

// ── Sentry error handler (captures 500s) ──
app.use(sentryErrorHandler());

// ── Final error handler ──
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err instanceof AppError ? err.statusCode : err.status || err.statusCode || 500;
  const isDev = process.env.NODE_ENV === "development";

  if (status >= 500) {
    console.error(`Unhandled error: ${err.message}`, err.stack);
  }

  if (res.headersSent) return;

  res.status(status).json({
    error: status >= 500 && !isDev ? "Internal server error" : err.message,
    type: err instanceof AppError ? err.type : "UNKNOWN_ERROR",
    ...(isDev && { stack: err.stack }),
  });
});

// ── Graceful shutdown ──
const server = app.listen(PORT, () => {
  console.log(`🚀 AppForge server running on http://localhost:${PORT}`);
  // ── Start self-healing production monitor ──
  if (ENV.isProduction && ENV.sentryDsn) {
    import("./agents/selfHealing.js").then(({ startSelfHealingWatcher }) => {
      const stopWatcher = startSelfHealingWatcher(300_000); // 5 min interval
      process.on("SIGTERM", () => stopWatcher());
      process.on("SIGINT", () => stopWatcher());
    }).catch(() => {});
  }
});

server.keepAliveTimeout = 65000; //略高于ALB的60秒
server.headersTimeout = 66000;

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(async () => {
    console.log("HTTP server closed");
    try {
      await closeDbConnection();
      console.log("Database connection closed");
    } catch (err) {
      console.error("Error closing DB:", err);
    }
    process.exit(0);
  });
  // Force exit after 30s if hanging
  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 30000);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  server.close(async () => {
    console.log("HTTP server closed");
    try {
      await closeDbConnection();
      console.log("Database connection closed");
    } catch (err) {
      console.error("Error closing DB:", err);
    }
    process.exit(0);
  });
  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 30000);
});
