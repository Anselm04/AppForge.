import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  createProject,
  ensureUserCredits,
  countBuildsThisMonth,
  getUserTier,
  getTierBuildLimit,
  deductCredits,
  addCredits,
} from "../db.js";
import { BUILD_CREDIT_COST } from "../lib/credits.js";
import { PROMPT_MAX_CHARS } from "../lib/prompt.js";
import { isOwnerEmail } from "../lib/owner.js";
import { BUILD_CAPABILITY_IDS } from "../lib/buildCapabilities.js";
import {
  PRODUCT_TYPES,
  resolveIntakeContract,
} from "../lib/productContract.js";
import { enrichProductContract } from "../lib/contractEnrichment.js";
import { logger } from "../_core/logger.js";
import {
  claimProjectBuildStart,
  releaseProjectBuildClaim,
} from "../services/build-claim.js";
import { enqueueBuild } from "../services/build-queue.js";

export const generateRouter = Router();

const bodySchema = z.object({
  description: z.string().min(1).max(PROMPT_MAX_CHARS),
  techStack: z.string().min(1).max(80).optional(),
  productType: z.enum(PRODUCT_TYPES).optional(),
  title: z.string().min(1).max(255).optional(),
  locale: z.string().max(10).optional(),
  buildCapabilities: z.array(z.string()).max(10).optional(),
  hcaptchaToken: z.string().optional(),
});

/** Create a project from the canonical product contract and enqueue its build. */
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

    const description = parsed.data.description;
    const intake = resolveIntakeContract(description, parsed.data.techStack, {
      productType: parsed.data.productType,
    });
    if (!intake.ok && intake.reason === "clarification_required") {
      // Structured clarification (question + suggested choices). Answer by
      // resubmitting with `productType` set to one of the choice values.
      res.status(422).json({
        error: intake.reason,
        message: intake.message,
        confidence: intake.promptIntent.confidence,
        clarificationQuestions: intake.clarificationQuestions,
        clarification: intake.clarification,
      });
      return;
    }
    if (!intake.ok) {
      res.status(400).json({
        error: intake.reason,
        message: intake.message,
        compatibleStack: intake.compatibleStack,
      });
      return;
    }
    const { promptIntent } = intake;
    const baseContract = intake.productContract;
    const techStack = baseContract.selectedTechnologyStack;
    const title = (parsed.data.title || description).trim().slice(0, 60);
    const locale = parsed.data.locale || "en";
    const inferredCapabilities = baseContract.productFamilies.filter((family) =>
      (BUILD_CAPABILITY_IDS as readonly string[]).includes(family),
    );
    const buildCapabilities = [
      ...new Set([
        ...(parsed.data.buildCapabilities ?? []),
        ...inferredCapabilities,
      ]),
    ].filter((id) => (BUILD_CAPABILITY_IDS as readonly string[]).includes(id));
    const owner = isOwnerEmail(user.email);

    if (!owner) {
      const { verifyHcaptchaToken } = await import("../lib/hcaptcha.js");
      if (!(await verifyHcaptchaToken(parsed.data.hcaptchaToken))) {
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
      if (limit !== null && (await countBuildsThisMonth(user.id)) >= limit) {
        res.status(403).json({
          error: "tier_limit",
          message: `Tier limit reached (${limit} builds/month on ${tier} plan). Upgrade for more builds.`,
        });
        return;
      }
      const credits = await ensureUserCredits(user.id);
      if (
        !credits.unlimited &&
        credits.tier !== "lifetime" &&
        credits.balance < BUILD_CREDIT_COST
      ) {
        res.status(402).json({
          error: "credits_exhausted",
          message: `Out of credits (${credits.balance}/${BUILD_CREDIT_COST}). Subscribe or buy extra credits to start a build.`,
        });
        return;
      }
    }

    // Optional model enrichment runs only after captcha, moderation, and
    // credit checks. It adds schema-valid items or falls back unchanged.
    const { contract } = await enrichProductContract(baseContract);

    const id = await createProject({
      userId: user.id,
      title,
      description,
      techStack,
      status: "pending",
      locale,
      buildCapabilities,
      productContract: contract,
    });
    if (!(await claimProjectBuildStart(id, user.id)))
      throw new Error(`Unable to claim newly created project ${id} for build`);

    const credits = await ensureUserCredits(user.id);
    const unlimited =
      owner || !!credits.unlimited || credits.tier === "lifetime";
    const reservationCharged = !unlimited;
    const createdAt = new Date().toISOString();
    let charged = false;
    try {
      if (reservationCharged) {
        await deductCredits(
          user.id,
          BUILD_CREDIT_COST,
          id,
          "Build reservation",
        );
        charged = true;
      }
      await enqueueBuild({
        projectId: id,
        userId: user.id,
        description,
        techStack,
        locale,
        buildCapabilities,
        promptIntent,
        productContract: contract,
        createdAt,
        reservationCharged,
      });
    } catch (err: unknown) {
      if (charged) {
        try {
          await addCredits(
            user.id,
            BUILD_CREDIT_COST,
            "build_refund",
            `Build start refund for project ${id}`,
            `generate-build-refund-${id}-${createdAt}`,
          );
        } catch (refundErr: unknown) {
          logger.error(
            { projectId: id, error: refundErr },
            "generate_build_refund_failed",
          );
        }
      }
      await releaseProjectBuildClaim(id, user.id, "pending", null);
      throw err;
    }

    res.json({
      id,
      status: "running",
      techStack,
      requestType: contract.productType,
      productFamilies: contract.productFamilies,
      researchRequired: contract.researchRequirements.length > 0,
      monetizationRequested: contract.monetizationRequirements.length > 0,
      requirementCount: contract.functionalRequirements.length,
      intentConfidence: promptIntent.confidence,
      secondaryCapabilities: promptIntent.secondaryCapabilities,
    });
  } catch (err: unknown) {
    logger.error({ error: err }, "generate_failed");
    res.status(500).json({
      error: "generate_failed",
      message: "Unable to create or start the project. Please try again.",
    });
  }
});
