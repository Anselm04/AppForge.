import type { NextFunction, Request, Response } from "express";
import { supabaseAuthMiddleware } from "./supabaseAuth.js";
import { requireAuthenticatedUser } from "./requireAuthenticatedUser.js";

/**
 * Strict authentication middleware for protected AppForge REST routes.
 * supabaseAuthMiddleware validates the Supabase identity and the second barrier
 * fails closed when no verified AppForge user was established.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  return supabaseAuthMiddleware(req, res, (error?: unknown) => {
    if (error) return next(error);
    return requireAuthenticatedUser(req, res, next);
  });
}
