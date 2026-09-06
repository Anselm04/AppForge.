import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  createProject,
  ensureUserCredits,
  countBuildsThisMonth,
  getUserTier,
  getTierBuildLimit,
} from "../db.js";
import { BUILD_CREDIT_COST } from "../lib/credits.js";
import { PROMPT_MAX_CHARS } from "../lib/prompt.js";
import { isOwnerEmail } from "../lib/owner.js";
import { BUILD_CAPABILITY_IDS } from "../lib/buildCapabilities.js";

export const generateRouter = Router();

const bodySchema = z.object({
  description: z.string().min(1).max(PROMPT_MAX_CHARS),
  techStack: z.string().min(1).max(80).default("react-node"),
  title: z.string().min(1).max(255).optional(),
  locale: z.string().max(10).optional(),
  buildCapabilities: z.array(z.string()).max(10).optional(),
  hcaptchaToken: z.string().optional(),
});

/**
 * Honest Generate: create a pending project only.
 * Real agentic work happens on SSE GET /api/build/:id (pipeline).
 * Never returns completed/template/guaranteed-green apps from this path.
 */
generateRouter.post("/", async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({
        error: "Not authenticated",
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
      return;
    }

    const parsed = bodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        error: "invalid_input",
        message: parsed.error.issues[0]?.message || "Invalid generate payload",
      });
      return;
    }

    const description = parsed.data.description.trim();
    const techStack = parsed.data.techStack || "react-node";
    const title = (parsed.data.title || description).trim().slice(0, 60);
    const locale = parsed.data.locale || "en";
    const buildCapabilities = (parsed.data.buildCapabilities ?? []).filter(
      (id) => (BUILD_CAPABILITY_IDS as readonly string[]).includes(id),
    );
    const owner = isOwnerEmail(user.email);

    if (!owner) {
      const { verifyHcaptchaToken } = await import("../lib/hcaptcha.js");
      const captchaOk = await verifyHcaptchaToken(parsed.data.hcaptchaToken);
      if (!captchaOk) {
        res.status(403).json({
          error: "captcha_failed",
          message:
            "Captcha verification failed. Complete the challenge and try again.",
        });
        return;
      }

      const { moderateUserContent } = await import("../routers/moderation.js");
      const moderation = await moderateUserContent(
        user.id,
        description + " " + title,
      );
      if (!moderation.allowed) {
        res.status(403).json({
          error: "content_flagged",
          message: moderation.reason ?? "Content flagged",
        });
        return;
      }

      const tier = await getUserTier(user.id);
      const limit = getTierBuildLimit(tier);
      if (limit !== null) {
        const buildsThisMonth = await countBuildsThisMonth(user.id);
        if (buildsThisMonth >= limit) {
          res.status(403).json({
            error: "tier_limit",
            message: `Tier limit reached (${limit} builds/month on ${tier} plan). Upgrade for more builds.`,
          });
          return;
        }
      }

      const credits = await ensureUserCredits(user.id);
      const unlimited = !!credits.unlimited || credits.tier === "lifetime";
      if (!unlimited && credits.balance < BUILD_CREDIT_COST) {
        res.status(402).json({
          error: "credits_exhausted",
          message: `Out of credits (${credits.balance}/${BUILD_CREDIT_COST}). Subscribe or buy extra credits to start a build.`,
        });
        return;
      }
    }

    const id = await createProject({
      userId: user.id,
      title,
      description,
      techStack,
      status: "pending",
      locale,
      buildCapabilities,
    });

    res.json({ id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generate failed";
    console.error("generate failed:", message);
    res.status(500).json({ error: "generate_failed", message });
  }
});
