import { Router, Request, Response } from "express";
import { z } from "zod";
import { getProjectsByUserId, ensureUserCredits } from "../db.js";

const appsCompatRouter = Router();
const billingCompatRouter = Router();

const APP_URL = "https://appforge-unfurling-moon-9058.fly.dev";

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
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to list apps" });
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
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to load app" });
  }
});

billingCompatRouter.get("/credits", async (req: Request, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;
  try {
    const credits = await ensureUserCredits(user.id);
    res.json({ credits: credits.balance, balance: credits.balance, tier: credits.tier });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to load credits" });
  }
});

const checkoutSchema = z.object({
  plan: z.enum(["starter", "builder", "studio"]).optional(),
  credits: z.number().int().positive().max(10000).optional(),
  priceId: z.string().optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

async function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe not configured");
  const { default: Stripe } = await import("stripe");
  return new Stripe(key, { apiVersion: "2023-10-16" });
}

function getPriceId(plan: string): string {
  const map: Record<string, string> = {
    starter: process.env.STRIPE_STARTER_PRICE_ID || process.env.STRIPE_PRICE_STARTER || "",
    builder: process.env.STRIPE_BUILDER_PRICE_ID || process.env.STRIPE_PRICE_BUILDER || "",
    studio: process.env.STRIPE_STUDIO_PRICE_ID || process.env.STRIPE_PRICE_STUDIO || "",
  };
  const id = map[plan];
  if (!id) throw new Error(`Stripe price ID not configured for plan: ${plan}`);
  return id;
}

async function startCheckout(req: Request, res: Response) {
  const user = requireUser(req, res);
  if (!user) return;

  const body = { ...req.body, ...req.query };
  if (typeof body.credits === "string") body.credits = parseInt(body.credits, 10);

  const parse = checkoutSchema.safeParse(body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid input", details: parse.error.issues });
    return;
  }

  const { plan, credits, priceId } = parse.data;
  if (!plan && !priceId && !credits) {
    res.status(400).json({ error: "plan, priceId, or credits is required" });
    return;
  }

  try {
    const stripe = await getStripe();
    const successUrl = parse.data.successUrl ?? `${APP_URL}/dashboard`;
    const cancelUrl = parse.data.cancelUrl ?? `${APP_URL}/pricing`;
    const mode = plan || priceId ? "subscription" : "payment";
    const lineItems = plan || priceId
      ? [{ price: priceId ?? getPriceId(plan!), quantity: 1 }]
      : [{
          price_data: {
            currency: "usd",
            unit_amount: 100,
            product_data: { name: `${credits} Build Credits` },
          },
          quantity: credits!,
        }];

    const session = await stripe.checkout.sessions.create({
      mode: mode as any,
      payment_method_types: ["card"],
      line_items: lineItems as any,
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: String(user.id),
      metadata: {
        userId: String(user.id),
        plan: plan ?? "",
        tier: plan ?? "",
        credits: String(credits ?? 0),
      },
      customer_email: user.email,
      ...(mode === "subscription"
        ? { subscription_data: { metadata: { userId: String(user.id), plan: plan ?? "", tier: plan ?? "" } } }
        : {}),
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error("Billing checkout error:", err);
    res.status(500).json({ error: err.message || "Checkout failed" });
  }
}

billingCompatRouter.post("/checkout", startCheckout);
billingCompatRouter.get("/checkout", startCheckout);

export { appsCompatRouter, billingCompatRouter };
