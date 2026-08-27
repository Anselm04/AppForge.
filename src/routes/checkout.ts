import { Router, Request, Response } from "express";
import { z } from "zod";

const router = Router();

const checkoutSchema = z.object({
  plan: z.enum(["starter", "builder", "studio"]).optional(),
  credits: z.number().int().positive().max(10000).optional(),
  priceId: z.string().optional(),
  successUrl: z.string().url().default("https://appforge-unfurling-moon-9058.fly.dev/build"),
  cancelUrl: z.string().url().default("https://appforge-unfurling-moon-9058.fly.dev/pricing"),
});

async function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe not configured");
  const { default: Stripe } = await import("stripe");
  return new Stripe(key, { apiVersion: "2023-10-16" });
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
      res.status(400).json({ error: "Invalid input", details: parse.error.issues });
      return;
    }

    const { plan, credits, priceId, successUrl, cancelUrl } = parse.data;
    const stripe = await getStripe();

    const mode = plan || priceId ? "subscription" : "payment";
    const lineItems = plan || priceId
      ? [{ price: priceId ?? getPriceId(plan!), quantity: 1 }]
      : [{ price_data: { currency: "usd", unit_amount: 100, product_data: { name: `${credits} Build Credits` } }, quantity: credits! }];

    const session = await stripe.checkout.sessions.create({
      mode: mode as any,
      payment_method_types: ["card"],
      line_items: lineItems as any,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId: String(user.id), plan: plan ?? "", credits: String(credits ?? 0) },
      customer_email: user.email,
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error("Checkout error:", err);
    res.status(500).json({ error: err.message || "Checkout failed" });
  }
});

function getPriceId(plan: string): string {
  const map: Record<string, string> = {
    starter: process.env.STRIPE_STARTER_PRICE_ID || "",
    builder: process.env.STRIPE_BUILDER_PRICE_ID || "",
    studio: process.env.STRIPE_STUDIO_PRICE_ID || "",
  };
  const id = map[plan];
  if (!id) throw new Error(`Stripe price ID not configured for plan: ${plan}`);
  return id;
}

export default router;
export const checkoutRouter = router;
