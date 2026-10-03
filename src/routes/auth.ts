import { Router, type Request, type Response } from "express";

/**
 * REST auth helpers used by the SPA session continuity path.
 * Identity still comes exclusively from supabaseAuthMiddleware (req.user).
 */
export const authRouter = Router();

authRouter.get("/me", (req: Request, res: Response) => {
  if (!req.user?.id) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(401).json({
      error: "Not authenticated",
      code: "AUTH_REQUIRED",
    });
  }

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    id: req.user.id,
    email: req.user.email,
    name: req.user.name,
    supabaseUid: req.user.supabaseUid,
  });
});
