import type { NextFunction, Request, Response } from "express";
import { supabaseAuthMiddleware } from "./supabaseAuth.js";
import { requireAuthenticatedUser } from "./requireAuthenticatedUser.js";

/**
 * Strict authentication middleware for protected AppForge REST routes.
 *
 * supabaseAuthMiddleware validates the Supabase bearer token (or the secure
 * server session cookie), refreshes an eligible HttpOnly session when needed,
 * and populates req.user only after Supabase validation. The second barrier
 * then fails closed when no verified AppForge user was established.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void | Promise<void> {
  return supabaseAuthMiddleware(req, res, (error?: unknown) => {
    if (error) return next(error);
    return requireAuthenticatedUser(req, res, next);
  });
}
