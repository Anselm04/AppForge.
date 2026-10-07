import type { NextFunction, Request, Response } from "express";
import { hasValidLoginMfa } from "../lib/loginMfa.js";

/**
 * Fail-closed authorization barrier for REST routes that require a verified
 * AppForge user. supabaseAuthMiddleware must run before this middleware so that
 * req.user can only be populated from a token validated by Supabase.
 */
export function requireAuthenticatedUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.user?.id) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(401).json({
      error: "Not authenticated",
      code: "AUTH_REQUIRED",
    });
  }

  if (!hasValidLoginMfa(req, req.user.supabaseUid)) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(403).json({
      error: "Phone verification required",
      code: "PHONE_VERIFICATION_REQUIRED",
    });
  }

  return next();
}
