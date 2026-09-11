import { getSubscriptionByUserId } from "../db.js";

export const SELF_SERVE_PLAN_TIERS = ["starter", "builder", "studio"] as const;
export type SelfServePlanTier = (typeof SELF_SERVE_PLAN_TIERS)[number];

export const CREDIT_PACKS = [50, 100, 250] as const;
export type CreditPack = (typeof CREDIT_PACKS)[number];

const TERMINAL_SUBSCRIPTION_STATUSES = new Set(["canceled", "incomplete_expired"]);

const APP_URL =
  process.env.PUBLIC_APP_URL || "https://appforge-unfurling-moon-9058.fly.dev";

const PLAN_PRICE_IDS: Record<SelfServePlanTier, string> = {
  starter:
    process.env.STRIPE_STARTER_PRICE_ID ||
    process.env.STRIPE_PRICE_STARTER ||
    "",
  builder:
    process.env.STRIPE_BUILDER_PRICE_ID ||
    process.env.STRIPE_PRICE_BUILDER ||
    "",
  studio:
    process.env.STRIPE_STUDIO_PRICE_ID || process.env.STRIPE_PRICE_STUDIO || "",
};

const CREDIT_PRICE_IDS: Record<CreditPack, string> = {
  50: process.env.STRIPE_CREDITS_50_PRICE_ID || "",
  100: process.env.STRIPE_CREDITS_100_PRICE_ID || "",
  250: process.env.STRIPE_CREDITS_250_PRICE_ID || "",
};

type CheckoutUser = {
  id: number;
  email?: string | null;
};

async function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe not configured");
  const { default: Stripe } = await import("stripe");
  return new Stripe(key, { apiVersion: "2024-06-20" as any });
}

function requirePlanPriceId(tier: SelfServePlanTier) {
  const id = PLAN_PRICE_IDS[tier];
  if (!id) throw new Error(`Stripe price ID not configured for tier: ${tier}`);
  return id;
}

function requireCreditPriceId(credits: CreditPack) {
  const id = CREDIT_PRICE_IDS[credits];
  if (!id) {
    throw new Error(`Stripe price ID not configured for credit pack: ${credits}`);
  }
  return id;
}

function assertCanCreateSubscription(
  sub: Awaited<ReturnType<typeof getSubscriptionByUserId>>,
) {
  if (!sub) return;

  const status = sub.status ?? "";
  const hasManagedSubscription =
    !!sub.stripeSubscriptionId && !TERMINAL_SUBSCRIPTION_STATUSES.has(status);
  const hasActivePaidEntitlement =
    (status === "active" || status === "trialing") &&
    !!sub.tier &&
    sub.tier !== "free";

  if (hasManagedSubscription || hasActivePaidEntitlement) {
    throw new Error(
      "An existing Stripe subscription must be managed or recovered before starting another checkout.",
    );
  }
}

export async function createPlanCheckout(
  user: CheckoutUser,
  tier: SelfServePlanTier,
) {
  const stripe = await getStripe();
  const sub = await getSubscriptionByUserId(user.id);
  assertCanCreateSubscription(sub);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: requirePlanPriceId(tier), quantity: 1 }],
    success_url: `${APP_URL}/dashboard?checkout=success`,
    cancel_url: `${APP_URL}/pricing?checkout=cancelled`,
    customer: sub?.stripeCustomerId ?? undefined,
    customer_email: sub?.stripeCustomerId ? undefined : (user.email ?? undefined),
    client_reference_id: String(user.id),
    metadata: {
      userId: String(user.id),
      plan: tier,
      tier,
      credits: "0",
    },
    subscription_data: {
      metadata: {
        userId: String(user.id),
        plan: tier,
        tier,
      },
    },
  });
  return { url: session.url };
}

export async function createCreditCheckout(
  user: CheckoutUser,
  credits: CreditPack,
) {
  const stripe = await getStripe();
  const sub = await getSubscriptionByUserId(user.id);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{ price: requireCreditPriceId(credits), quantity: 1 }],
    success_url: `${APP_URL}/dashboard?checkout=success`,
    cancel_url: `${APP_URL}/pricing?checkout=cancelled`,
    customer: sub?.stripeCustomerId ?? undefined,
    customer_email: sub?.stripeCustomerId ? undefined : (user.email ?? undefined),
    client_reference_id: String(user.id),
    metadata: {
      userId: String(user.id),
      plan: "",
      tier: "",
      credits: String(credits),
    },
  });
  return { url: session.url };
}
