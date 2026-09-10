import express from "express";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers/index.js";
import { createContext } from "./_core/context.js";
import { stripeWebhookHandler } from "./webhooks/stripe.js";
import { ENV } from "./_core/env.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import * as Sentry from "@sentry/node";
import { securityHeaders } from "./middleware/securityHeaders.js";
import { corsOrigin } from "./middleware/corsOrigin.js";
import { compressionMiddleware } from "./middleware/compression.js";
import { createRateLimiter } from "./middleware/rateLimiter.js";
import { createSlowDown } from "./middleware/slowDown.js";
import {
  sentryErrorHandler,
  sentryRequestLogging,
} from "./middleware/sentryHandler.js";
import { healthRouter } from "./routes/health.js";
import { aiRouter } from "./routes/ai.js";
import { agentsRouter } from "./routes/agents.js";
import { buildRouter } from "./routes/build.js";
import { checkoutRouter } from "./routes/checkout.js";
import {
  appsCompatRouter,
  billingCompatRouter,
} from "./routes/legacyCompat.js";
import { livePreviewRouter } from "./routes/livePreview.js";
import { hostedAppsRouter } from "./routes/hostedApps.js";
import { generateRouter } from "./routes/generate.js";
import { sandboxDevProxyRouter } from "./routes/sandboxDevProxy.js";
import { ssoHttpRouter } from "./routes/sso.js";
import { githubOAuthRouter } from "./routes/githubOAuth.js";
import { supabaseAuthMiddleware } from "./middleware/supabaseAuth.js";
import { webContainerHeaders } from "./middleware/webContainerHeaders.js";
import {
  csrfProtection,
  csrfTokenHandler,
  csrfErrorHandler,
} from "./middleware/csrf.js";
import { closeDbConnection, getProjectById } from "./db.js";
import { ensureAppSchema } from "./db/ensureSchema.js";
import { logger } from "./_core/logger.js";
import { AppError } from "./utils/errorReporting.js";
import { validateEnv } from "./utils/env-validator.js";

const app = express();
const PORT = process.env.PORT || 3000;
const REQUEST_TIMEOUT = parseInt(
  process.env.REQUEST_TIMEOUT_MS || "330000",
  10,
);
const clientDir = path.resolve(process.cwd(), "dist/client");

// ── Sentry initialization (before middleware) ──
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",
  release: process.env.npm_package_version,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
});

// ── Trust proxy when behind ALB / Cloudflare / Fly ──
if (ENV.isProduction) {
  app.set("trust proxy", true);
}

// ── SSL/HTTPS enforcement (production only) ──
// Fly health checks hit the machine over HTTP with no x-forwarded-proto.
// Only redirect when the edge explicitly says the client used http.
if (ENV.isProduction) {
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/health")) return next();
    const proto = req.headers["x-forwarded-proto"] as string | undefined;
    if (proto === "http") {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// ── Security & compression ──
app.use(securityHeaders());
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-api-key",
      "stripe-signature",
      "x-csrf-token",
      "x-xsrf-token",
    ],
  }),
);
app.use(compressionMiddleware());
app.use(webContainerHeaders());

// ── Request logging (Sentry + structured logger) ──
app.use(sentryRequestLogging());
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info(
      {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: duration,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        userId: (req as any).user?.id ?? null,
      },
      "http_request",
    );
  });
  next();
});

// ── Request timeout middleware ──
// SSE builds run up to ~5 minutes; do not kill those sockets at 30s.
app.use((req, res, next) => {
  if (
    req.path.startsWith("/api/build") ||
    req.path.startsWith("/live") ||
    req.path.startsWith("/apps")
  ) {
    req.setTimeout(0);
    res.setTimeout(0);
    return next();
  }
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
    windowMs: 1 * 60 * 1000,
    max: 60,
    message:
      "Webhook rate limit exceeded. Please retry with exponential backoff.",
  });
  app.use("/api/webhooks/stripe", webhookLimiter);
})().catch((error) => logger.error({ error }, "webhook_rate_limiter_init_failed"));

// Stripe webhook (raw body required — before JSON parser)
app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler,
);

// ── CSRF (after webhook; CodeQL js/missing-token-validation) ──
app.use(csrfProtection);
app.get("/api/csrf-token", csrfTokenHandler);

// ── Global middleware ──
app.use(express.json({ limit: "10mb" }));

// ── Rate limiting: global + API ──
(async () => {
  const globalLimiter = await createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: "Too many requests, please try again later.",
  });
  const apiLimiter = await createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: "API rate limit exceeded, please slow down.",
  });
  const buildLimiter = await createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message:
      "Build rate limit exceeded. Please wait before creating more builds.",
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
  app.use("/api/generate", buildLimiter);
  app.use("/api/trpc", apiLimiter);
})().catch((error) => logger.error({ error }, "api_rate_limiter_init_failed"));

// ── Health check (with DB verification on / , liveness on /live) ──
app.use("/api/health", healthRouter);

// ── Auth middleware (sets req.user for all protected routes below) ──
app.use("/api", supabaseAuthMiddleware);
app.use("/api/trpc", supabaseAuthMiddleware);

// Issue a short-lived, signed preview cookie scoped to one sandbox project.
// The bearer token is validated by supabaseAuthMiddleware and is never copied
// into the iframe URL, browser history, referrers, or proxy logs.
app.get("/api/preview-auth/:projectId", async (req, res) => {
  const authorization = req.headers.authorization;
  const userId = req.user?.id;
  const projectId = Number.parseInt(String(req.params.projectId), 10);
  if (
    !userId ||
    !Number.isFinite(projectId) ||
    typeof authorization !== "string" ||
    !/^Bearer\s+\S+/i.test(authorization)
  ) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const project = await getProjectById(projectId);
  if (!project || project.userId !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  res.cookie(`appforge-preview-${projectId}`, String(userId), {
    httpOnly: true,
    secure: ENV.isProduction,
    sameSite: "strict",
    signed: true,
    path: `/sandbox-dev/${projectId}`,
    maxAge: 10 * 60 * 1000,
  });
  res.setHeader("Cache-Control", "no-store");
  return res.status(204).end();
});

// ── REST API routes ──
app.use("/api/ai", aiRouter);
app.use("/api/agents", agentsRouter);
app.use("/api/build", buildRouter);
app.use("/api/generate", generateRouter);
app.use("/api/checkout", supabaseAuthMiddleware, checkoutRouter);
app.use("/api/apps", appsCompatRouter);
app.use("/api/billing", billingCompatRouter);
app.use("/api/github", githubOAuthRouter);
app.use("/api/sso", ssoHttpRouter);
app.use("/live", supabaseAuthMiddleware, livePreviewRouter);
app.use("/apps", hostedAppsRouter);
app.use("/sandbox-dev", supabaseAuthMiddleware, sandboxDevProxyRouter);

// ── tRPC routes ──
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
    allowMethodOverride: true,
  }),
);

// Public runtime config so Fly secrets work without baking VITE_* at image build time.
app.get("/config.js", (_req, res) => {
  const payload = {
    supabaseUrl:
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "",
    supabasePublishableKey:
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      "",
    stripePublicKey: process.env.VITE_STRIPE_PUBLIC_KEY || "",
    hcaptchaSiteKey:
      process.env.VITE_HCAPTCHA_SITE_KEY || process.env.HCAPTCHA_SITE_KEY || "",
  };
  res.setHeader("Cache-Control", "no-store");
  res.type("application/javascript");
  res.send(`window.__APPFORGE_CONFIG__=${JSON.stringify(payload)};`);
});

// ── SPA: serve Vite client assets, then index.html ──
if (ENV.isProduction) {
  app.use(express.static(clientDir, { index: false, fallthrough: true }));
  app.get("*", (req, res, next) => {
    if (
      req.path.startsWith("/api") ||
      req.path === "/config.js" ||
      req.path.startsWith("/live") ||
      req.path.startsWith("/apps")
    )
      return next();
    res.sendFile(path.join(clientDir, "index.html"), (err) => {
      if (err) next(err);
    });
  });
}

// ── 404 handler ──
app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.path });
});

// ── CSRF error mapping (before Sentry / generic handler) ──
app.use(csrfErrorHandler);

// ── Sentry error handler (captures 500s) ──
app.use(sentryErrorHandler());

// ── Final error handler ──
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const status =
      err instanceof AppError
        ? err.statusCode
        : err.status || err.statusCode || 500;
    const isDev = process.env.NODE_ENV === "development";

    if (status >= 500) {
      logger.error(
        { error: err, method: req.method, path: req.path, status },
        "unhandled_http_error",
      );
    }

    if (res.headersSent) return;

    res.status(status).json({
      error: status >= 500 && !isDev ? "Internal server error" : err.message,
      type: err instanceof AppError ? err.type : "UNKNOWN_ERROR",
      ...(isDev && { stack: err.stack }),
    });
  },
);

// ── Graceful shutdown ──
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "unhandled_rejection");
});
process.on("uncaughtException", (err) => {
  logger.error({ error: err }, "uncaught_exception");
});

let server: ReturnType<typeof app.listen>;

async function start() {
  const envResult = validateEnv(process.env as any);
  if (envResult.errors.length > 0) {
    logger.error({ errors: envResult.errors }, "environment_validation_failed");
  }
  if (envResult.warnings.length > 0) {
    logger.warn({ warnings: envResult.warnings }, "environment_validation_warnings");
  }
  if (
    process.env.ENFORCE_ENV_VALIDATION !== "false" &&
    ENV.isProduction &&
    !envResult.valid
  ) {
    throw new Error(
      "Environment validation failed in production. Set ENFORCE_ENV_VALIDATION=false to override (not recommended).",
    );
  }

  try {
    await ensureAppSchema();
  } catch (err) {
    logger.error({ error: err }, "schema_ensure_failed");
    if (ENV.isProduction) throw err;
  }
  server = app.listen(PORT, () => {
    logger.info({ port: PORT }, "appforge_server_started");
    import("./services/build-queue.js")
      .then(({ startBuildQueueWorker }) => {
        const stopQueue = startBuildQueueWorker(2000);
        process.on("SIGTERM", () => stopQueue());
        process.on("SIGINT", () => stopQueue());
      })
      .catch((error) => logger.error({ error }, "build_queue_worker_start_failed"));
    import("./services/vantaSync.js")
      .then(({ startVantaPoller }) => {
        const stopVanta = startVantaPoller();
        process.on("SIGTERM", () => stopVanta());
        process.on("SIGINT", () => stopVanta());
      })
      .catch((error) => logger.error({ error }, "vanta_poller_start_failed"));
    if (ENV.isProduction && ENV.sentryDsn) {
      import("./agents/selfHealing.js")
        .then(({ startSelfHealingWatcher }) => {
          const stopWatcher = startSelfHealingWatcher(300_000);
          process.on("SIGTERM", () => stopWatcher());
          process.on("SIGINT", () => stopWatcher());
        })
        .catch((error) => logger.error({ error }, "self_healing_watcher_start_failed"));
    }
  });
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
}

function shutdown(signal: string) {
  logger.info({ signal }, "shutdown_requested");
  if (!server) {
    process.exit(0);
    return;
  }
  server.close(async () => {
    logger.info({}, "http_server_closed");
    try {
      await closeDbConnection();
      logger.info({}, "database_connection_closed");
    } catch (err) {
      logger.error({ error: err }, "database_close_failed");
    }
    process.exit(0);
  });
  setTimeout(() => {
    logger.error({}, "forced_shutdown_timeout");
    process.exit(1);
  }, 30000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start();