/**
 * Sentry Error Handler Middleware
 */

import { Request, Response, NextFunction } from "express";
import * as Sentry from "@sentry/node";

const SENSITIVE_KEY =
  /authorization|cookie|token|secret|password|passwd|api[-_]?key|signature|session|credential|refresh/i;

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
  }
  if (value && typeof value === "object") {
    const clean: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      clean[key] = SENSITIVE_KEY.test(key)
        ? "[redacted]"
        : sanitizeValue(item, depth + 1);
    }
    return clean;
  }
  if (typeof value === "string" && value.length > 1000) {
    return `${value.slice(0, 1000)}…[truncated]`;
  }
  return value;
}

function safeRequestContext(req: Request) {
  return {
    method: req.method,
    path: req.path,
    query: sanitizeValue(req.query),
    params: sanitizeValue(req.params),
    body: sanitizeValue(req.body),
    headers: {
      "content-type": req.headers["content-type"],
      "user-agent": req.headers["user-agent"],
      "x-request-id": req.headers["x-request-id"],
    },
  };
}

export function sentryErrorHandler() {
  return (err: any, req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;

    Sentry.configureScope((scope) => {
      scope.setExtra("request", safeRequestContext(req));

      const user = (req as any).user;
      if (user) {
        scope.setUser({ id: String(user.id) });
      }
    });

    const eventId = Sentry.captureException(err);
    console.error(`Error captured by Sentry: ${eventId}`);

    if (res.headersSent) return next(err);

    res.status(status).json({
      error: status >= 500 ? "Internal server error" : err.message,
      ...(process.env.NODE_ENV === "development" && {
        stack: err.stack,
        details: err.details,
      }),
      ...(eventId && {
        eventId,
        message: "Error has been logged and will be investigated",
      }),
    });
  };
}

export function sentryRequestLogging() {
  return (req: Request, res: Response, next: NextFunction) => {
    Sentry.addBreadcrumb({
      category: "http",
      message: `${req.method} ${req.path}`,
      data: {
        method: req.method,
        path: req.path,
        query: sanitizeValue(req.query),
      },
      level: "info",
    });

    const transaction = Sentry.startTransaction(
      { op: "http", name: `${req.method} ${req.path}` },
      { trimEnd: true },
    );
    (req as any).__sentryTransaction = transaction;

    res.on("finish", () => {
      if ((req as any).__sentryTransaction) {
        (req as any).__sentryTransaction.setHttpStatus(res.statusCode);
        (req as any).__sentryTransaction.finish();
      }
    });

    next();
  };
}

export function sentryPerformance() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (duration > 1000) {
        Sentry.captureMessage("Slow request detected", {
          level: "warning",
          tags: {
            method: req.method,
            path: req.path,
            status: res.statusCode.toString(),
          },
          extra: { duration, threshold: 1000 },
        });
      }
    });

    next();
  };
}

export default sentryErrorHandler;
