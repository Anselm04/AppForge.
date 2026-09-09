import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction, RequestHandler } from "express";

const isProd = process.env.NODE_ENV === "production";
const COOKIE_NAME = "appforge_csrf";
const HEADER_NAMES = ["x-csrf-token", "x-xsrf-token"] as const;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function equalTokens(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Signed synchronizer-token CSRF protection.
 * cookie-parser verifies the HttpOnly signed cookie before this middleware runs.
 * Unsafe requests must echo the token in an explicit request header.
 * Stripe webhooks are registered before this middleware because Stripe uses its
 * own signature verification and cannot supply a browser CSRF token.
 */
export const csrfProtection: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (SAFE_METHODS.has(req.method.toUpperCase())) {
    next();
    return;
  }

  const cookieToken = req.signedCookies?.[COOKIE_NAME];
  const headerToken = HEADER_NAMES
    .map((name) => req.get(name))
    .find((value): value is string => typeof value === "string" && value.length > 0);

  if (
    typeof cookieToken !== "string" ||
    typeof headerToken !== "string" ||
    !equalTokens(cookieToken, headerToken)
  ) {
    const error = new Error("Invalid CSRF token") as Error & { code?: string };
    error.code = "EBADCSRFTOKEN";
    next(error);
    return;
  }

  next();
};

/** Issue a fresh CSRF token for SPA clients. */
export function csrfTokenHandler(_req: Request, res: Response): void {
  const token = randomBytes(32).toString("base64url");
  res.cookie(COOKIE_NAME, token, {
    signed: true,
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    path: "/",
  });
  res.setHeader("Cache-Control", "no-store");
  res.json({ csrfToken: token });
}

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
      message: "Refresh the page and retry the request.",
    });
    return;
  }
  next(err);
}
