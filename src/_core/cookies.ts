import { CookieSerializeOptions } from "cookie";
import type { Request } from "express";

export function getSessionCookieOptions(
  req: Request
): CookieSerializeOptions {
  const isProduction = process.env.NODE_ENV === "production";
  const isSecure = req.protocol === "https" || isProduction;

  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? "strict" : "lax",
    path: "/",
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  };
}
