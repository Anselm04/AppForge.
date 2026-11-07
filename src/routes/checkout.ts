import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  createCreditCheckout,
  createPlanCheckout,
  CREDIT_PACKS,
  SELF_SERVE_PLAN_TIERS,
} from "../services/stripeCheckout.js";
import { createProviderCreditCheckout } from "../services/providerCreditTopUps.js";
import { PURCHASED_PROVIDER_CREDIT_PACKS_CENTS } from "../lib/providerCreditPolicy.js";
import { logger } from "../_core/logger.js";

const router = Router();

const checkoutSchema = z
  .object({
    plan: z.enum(SELF_SERVE_PLAN_TIERS).optional(),
    credits: z
      .union(
        CREDIT_PACKS.map((value) => z.literal(value)) as [
          z.ZodLiteral<50>,
          z.ZodLiteral<100>,
          z.ZodLiteral<250>,
        ],
      )
      .optional(),
    providerCredits: z
      .union(
        PURCHASED_PROVIDER_CREDIT_PACKS_CENTS.map((value) =>
          z.literal(value),
        ) as [z.ZodLiteral<1000>, z.ZodLiteral<3000>, z.ZodLiteral<8000>],
      )
      .optional(),
  })
  .refine((d) => Boolean(d.plan || d.credits || d.providerCredits), {
    message: "plan or supported credit pack is required",
  })
  .refine(
    (d) => [d.plan, d.credits, d.providerCredits].filter(Boolean).length === 1,
    {
      message: "Choose exactly one plan or credit pack",
    },
  );

router.post("/", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const parse = checkoutSchema.safeParse(req.body);
    if (!parse.success) {
      res
        .status(400)
        .json({ error: "Invalid input", details: parse.error.issues });
      return;
    }

    const { plan, credits, providerCredits } = parse.data;
    const checkoutUser = {
      id: Number(user.id),
      email: user.email as string | undefined,
    };

    let result: { url: string | null };
    if (plan) {
      result = await createPlanCheckout(checkoutUser, plan);
    } else if (providerCredits) {
      result = await createProviderCreditCheckout(
        checkoutUser,
        providerCredits,
      );
    } else if (credits) {
      result = await createCreditCheckout(checkoutUser, credits);
    } else {
      throw new Error("Checkout requires a plan or credit pack");
    }
    if (!result.url) throw new Error("Stripe did not return a checkout URL");

    res.json(result);
  } catch (err: unknown) {
    logger.error({ error: err }, "checkout_error");
    res.status(500).json({
      error: "checkout_failed",
      message: "Unable to create checkout session. Please try again.",
    });
  }
});

export default router;
export const checkoutRouter = router;
