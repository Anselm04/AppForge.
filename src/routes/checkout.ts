import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  createCreditCheckout,
  createPlanCheckout,
  CREDIT_PACKS,
  SELF_SERVE_PLAN_TIERS,
} from "../services/stripeCheckout.js";
import { logger } from "../_core/logger.js";

const router = Router();

const checkoutSchema = z
  .object({
    plan: z.enum(SELF_SERVE_PLAN_TIERS).optional(),
    credits: z
      .union(CREDIT_PACKS.map((value) => z.literal(value)) as [
        z.ZodLiteral<50>,
        z.ZodLiteral<100>,
        z.ZodLiteral<250>,
      ])
      .optional(),
  })
  .refine((d) => Boolean(d.plan || d.credits), {
    message: "plan or supported credit pack is required",
  })
  .refine((d) => !(d.plan && d.credits), {
    message: "Choose either a subscription plan or a credit pack",
  });

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

    const { plan, credits } = parse.data;
    const checkoutUser = {
      id: Number(user.id),
      email: user.email as string | undefined,
    };

    const result = plan
      ? await createPlanCheckout(checkoutUser, plan)
      : await createCreditCheckout(checkoutUser, credits!);

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
