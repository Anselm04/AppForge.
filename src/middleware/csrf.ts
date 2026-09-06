import type { Request, Response, NextFunction, RequestHandler } from "express";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
// CodeQL recognizes the `csurf` package as CSRF middleware (js/missing-token-validation).
const csurf = require("csurf") as (options?: {
  cookie?:
    | boolean
    | {
        key?: string;
        httpOnly?: boolean;
        sameSite?: "lax" | "strict" | "none";
        secure?: boolean;
        path?: string;
      };
  ignoreMethods?: string[];
}) => RequestHandler;

const isProd = process.env.NODE_ENV === "production";

/**
 * Double-submit cookie CSRF via csurf (CodeQL-recognized).
 * Stripe webhooks must be registered BEFORE this middleware.
 */
export const csrfProtection: RequestHandler = csurf({
  cookie: {
    key: "_csrf",
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
  },
  ignoreMethods: ["GET", "HEAD", "OPTIONS"],
});

/** Issue a CSRF token for SPA clients (safe method; sets cookie). */
export function csrfTokenHandler(req: Request, res: Response): void {
  const token = (req as Request & { csrfToken(): string }).csrfToken();
  res.setHeader("Cache-Control", "no-store");
  res.json({ csrfToken: token });
}

/** Map csurf failures to a clear JSON body. */
export function csrfErrorHandler(
  err: any,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (err?.code === "EBADCSRFTOKEN") {
    res.status(403).json({
      error: "Invalid CSRF token",
      code: "EBADCSRFTOKEN",
      message: "Invalid CSRF token",
    });
    return;
  }
  next(err);
}
