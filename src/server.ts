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
import { ssoHttpRouter } from "./routes/sso.js";
import { githubOAuthRouter } from "./routes/githubOAuth.js";
import { supabaseAuthMiddleware } from "./middleware/supabaseAuth.js";
import { webContainerHeaders } from "./middleware/webContainerHeaders.js";
import { closeDbConnection } from "./db.js";
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

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",
  release: process.env.npm_package_version,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
});

if (ENV.isProduction) {
  app.set("trust proxy", true);
}

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

app.use(securityHeaders());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || (ENV.isProduction ? false : true),
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-api-key",
      "stripe-signature",
    ],
  }),
);
app.use(compressionMiddleware());
app.use(webContainerHeaders());

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

app.use((req, res, next) => {
  if (req.path.startsWith("/api/build") || req.path.startsWith("/live")) {
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

app.use(cookieParser(ENV.cookieSecret));

(async () => {
  const webhookLimiter = await createRateLimiter({
    windowMs: 1 * 60 * 1000,
    max: 60,
    message:
      "Webhook rate limit exceeded. Please retry with exponential backoff.",
  });
  app.use("/api/webhooks/stripe", webhookLimiter);
})().catch(() => {});

app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler,
);

app.use(express.json({ limit: "10mb" }));

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
  app.use("/api/trpc", apiLimiter);
})().catch(() => {});

app.use("/api/health", healthRouter);
app.use("/api", supabaseAuthMiddleware);
app.use("/api/trpc", supabaseAuthMiddleware);
app.use("/api/ai", aiRouter);
app.use("/api/agents", agentsRouter);
app.use("/api/build", buildRouter);
app.use("/api/checkout", supabaseAuthMiddleware, checkoutRouter);
app.use("/api/apps", appsCompatRouter);
app.use("/api/billing", billingCompatRouter);
app.use("/api/github", githubOAuthRouter);
app.use("/api/sso", ssoHttpRouter);
app.use("/live", supabaseAuthMiddleware, livePreviewRouter);

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

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

if (ENV.isProduction) {
  app.use(express.static(clientDir, { index: false, fallthrough: true }));
  app.get("*", (req, res, next) => {
    if (
      req.path.startsWith("/api") ||
      req.path === "/config.js" ||
      req.path.startsWith("/live")
    )
      return next();
    res.sendFile(path.join(clientDir, "index.html"), (err) => {
      if (err) next(err);
    });
  });
}

app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.path });
});

app.use(sentryErrorHandler());

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
      console.error(`Unhandled error: ${err.message}`, err.stack);
    }

    if (res.headersSent) return;

    res.status(status).json({
      error: status >= 500 && !isDev ? "Internal server error" : err.message,
      type: err instanceof AppError ? err.type : "UNKNOWN_ERROR",
      ...(isDev && { stack: err.stack }),
    });
  },
);

process.on("unhandledRejection", (reason) => {
  console.error("unhandledRejection", reason);
});
process.on("uncaughtException", (err) => {
  console.error("uncaughtException", err);
});

let server: ReturnType<typeof app.listen>;

async function start() {
  const envResult = validateEnv(process.env as any);
  if (envResult.errors.length > 0) {
    console.error("Environment validation errors:");
    envResult.errors.forEach((e) => console.error(`  - ${e}`));
  }
  if (envResult.warnings.length > 0) {
    console.warn("Environment validation warnings:");
    envResult.warnings.forEach((w) => console.warn(`  - ${w}`));
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
    console.error("Schema ensure failed:", err);
  }
  server = app.listen(PORT, () => {
    console.log(`AppForge server running on http://localhost:${PORT}`);
    import("./services/build-queue.js")
      .then(({ startBuildQueueWorker }) => {
        const stopQueue = startBuildQueueWorker(2000);
        process.on("SIGTERM", () => stopQueue());
        process.on("SIGINT", () => stopQueue());
      })
      .catch(() => {});
    import("./services/vantaSync.js")
      .then(({ startVantaPoller }) => {
        const stopVanta = startVantaPoller();
        process.on("SIGTERM", () => stopVanta());
        process.on("SIGINT", () => stopVanta());
      })
      .catch(() => {});
    if (ENV.isProduction && ENV.sentryDsn) {
      import("./agents/selfHealing.js")
        .then(({ startSelfHealingWatcher }) => {
          const stopWatcher = startSelfHealingWatcher(300_000);
          process.on("SIGTERM", () => stopWatcher());
          process.on("SIGINT", () => stopWatcher());
        })
        .catch(() => {});
    }
  });
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
}

function shutdown(signal: string) {
  console.log(`${signal} received, shutting down gracefully`);
  if (!server) {
    process.exit(0);
    return;
  }
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
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start();
