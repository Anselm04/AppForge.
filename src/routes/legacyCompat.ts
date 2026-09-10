import { Router, Request, Response } from "express";
import { getProjectsByUserId, ensureUserCredits } from "../db.js";
import { logger } from "../_core/logger.js";

const appsCompatRouter = Router();
const billingCompatRouter = Router();

function requireUser(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return user as { id: number; email?: string };
}

appsCompatRouter.get("/", async (req: Request, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;
  try {
    const projects = await getProjectsByUserId(user.id);
    res.json({ apps: projects, projects });
  } catch (err: unknown) {
    logger.error({ error: err, userId: user.id }, "legacy_apps_list_failed");
    res.status(500).json({ error: "Failed to list apps" });
  }
});

appsCompatRouter.get("/:id", async (req: Request, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;
  try {
    const { getProjectById } = await import("../db.js");
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const project = await getProjectById(id);
    if (!project || project.userId !== user.id) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(project);
  } catch (err: unknown) {
    logger.error(
      { error: err, userId: user.id, projectId: req.params.id },
      "legacy_app_load_failed",
    );
    res.status(500).json({ error: "Failed to load app" });
  }
});

billingCompatRouter.get("/credits", async (req: Request, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;
  try {
    const credits = await ensureUserCredits(user.id);
    res.json({
      credits: credits.balance,
      balance: credits.balance,
      tier: credits.tier,
    });
  } catch (err: unknown) {
    logger.error({ error: err, userId: user.id }, "legacy_credits_load_failed");
    res.status(500).json({ error: "Failed to load credits" });
  }
});

// Checkout intentionally lives only at /api/checkout. Do not add a legacy
// checkout alias here: pricing, redirects, identity, and Stripe metadata must
// remain server-owned by the canonical checkout route.

export { appsCompatRouter, billingCompatRouter };
