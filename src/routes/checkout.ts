import { Router, Request, Response } from "express";
import { z } from "zod";
import { getSubscriptionByUserId } from "../db.js";

const router = Router();

const APP_URL =
  process.env.PUBLIC_APP_URL || "https://appforge-unfurling-moon-9058.fly.dev";

const checkoutSchema = z
  .object({
    plan: z.enum(["starter", "builder", "studio", "enterprise"]).optional(),
    credits: z
      .union([z.literal(50), z.literal(100), z.literal(250)])
      .optional(),
  })
  .refine((d) => Boolean(d.plan || d.credits), {
    message: "plan or supported credit pack is required",
  })
  .refine((d) => !(d.plan && d.credits), {
    message: "Choose either a subscription plan or a credit pack",
  });

async function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe not configured");
  const { default: Stripe } = await import("stripe");
  return new Stripe(key, { apiVersion: "2024-06-20" as any });
}

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
    const stripe = await getStripe();
    const mode = plan ? "subscription" : "payment";
    const price = plan ? getPlanPriceId(plan) : getCreditPriceId(credits!);
    const tier = plan ?? "";
    const existingSub = await getSubscriptionByUserId(Number(user.id));

    const session = await stripe.checkout.sessions.create({
      mode,
      payment_method_types: ["card"],
      line_items: [{ price, quantity: 1 }],
      success_url: `${APP_URL}/dashboard?checkout=success`,
      cancel_url: `${APP_URL}/pricing?checkout=cancelled`,
      client_reference_id: String(user.id),
      metadata: {
        userId: String(user.id),
        plan: tier,
        tier,
        credits: String(credits ?? 0),
      },
      customer: existingSub?.stripeCustomerId ?? undefined,
      customer_email: existingSub?.stripeCustomerId ? undefined : user.email,
      ...(mode === "subscription"
        ? {
            subscription_data: {
              metadata: { userId: String(user.id), plan: tier, tier },
            },
          }
        : {}),
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error("Checkout error:", err);
    res.status(500).json({ error: err.message || "Checkout failed" });
  }
});

function getPlanPriceId(
  plan: "starter" | "builder" | "studio" | "enterprise",
): string {
  const map: Record<typeof plan, string> = {
    starter:
      process.env.STRIPE_STARTER_PRICE_ID ||
      process.env.STRIPE_PRICE_STARTER ||
      "",
    builder:
      process.env.STRIPE_BUILDER_PRICE_ID ||
      process.env.STRIPE_PRICE_BUILDER ||
      "",
    studio:
      process.env.STRIPE_STUDIO_PRICE_ID ||
      process.env.STRIPE_PRICE_STUDIO ||
      "",
    enterprise:
      process.env.STRIPE_ENTERPRISE_PRICE_ID ||
      process.env.STRIPE_PRICE_ENTERPRISE ||
      "",
  };
  const id = map[plan];
  if (!id) throw new Error(`Stripe price ID not configured for plan: ${plan}`);
  return id;
}

function getCreditPriceId(credits: 50 | 100 | 250): string {
  const map: Record<typeof credits, string> = {
    50: process.env.STRIPE_CREDITS_50_PRICE_ID || "",
    100: process.env.STRIPE_CREDITS_100_PRICE_ID || "",
    250: process.env.STRIPE_CREDITS_250_PRICE_ID || "",
  };
  const id = map[credits];
  if (!id) {
    throw new Error(
      `Stripe price ID not configured for credit pack: ${credits}`,
    );
  }
  return id;
}

export default router;
export const checkoutRouter = router;
