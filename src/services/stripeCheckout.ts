import { getSubscriptionByUserId } from "../db.js";
import { getAppForgeStripe } from "./appForgeStripe.js";
import {
  assertAppForgePrice,
  MONTHLY_PLAN_USD_CENTS,
  TOPUP_USD_CENTS,
} from "./appForgePricePolicy.js";

export const SELF_SERVE_PLAN_TIERS = ["starter", "builder", "studio"] as const;
export type SelfServePlanTier = (typeof SELF_SERVE_PLAN_TIERS)[number];

export const CREDIT_PACKS = [50, 100, 250] as const;
export type CreditPack = (typeof CREDIT_PACKS)[number];

const TERMINAL_SUBSCRIPTION_STATUSES = new Set([
  "canceled",
  "incomplete_expired",
]);

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

function requireAppUrl() {
  const value = process.env.PUBLIC_APP_URL?.trim();
  if (!value) {
    throw new Error("PUBLIC_APP_URL is required for Stripe checkout redirects");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("PUBLIC_APP_URL must be a valid absolute URL");
  }

  if (url.protocol !== "https:" && process.env.NODE_ENV === "production") {
    throw new Error("PUBLIC_APP_URL must use HTTPS in production");
  }

  return url.origin;
}

async function getStripe() {
  return getAppForgeStripe();
}

function requirePlanPriceId(tier: SelfServePlanTier) {
  const id = PLAN_PRICE_IDS[tier];
  if (!id) throw new Error(`Stripe price ID not configured for tier: ${tier}`);
  return id;
}

function requireCreditPriceId(credits: CreditPack) {
  const id = CREDIT_PRICE_IDS[credits];
  if (!id) {
    throw new Error(
      `Stripe price ID not configured for credit pack: ${credits}`,
    );
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
  const appUrl = requireAppUrl();
  const sub = await getSubscriptionByUserId(user.id);
  assertCanCreateSubscription(sub);
  const priceId = requirePlanPriceId(tier);
  const price = await stripe.prices.retrieve(priceId);
  assertAppForgePrice(
    price,
    MONTHLY_PLAN_USD_CENTS[tier],
    "recurring",
    process.env.NODE_ENV === "production",
  );

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard?checkout=success`,
    cancel_url: `${appUrl}/pricing?checkout=cancelled`,
    customer: sub?.stripeCustomerId ?? undefined,
    customer_email: sub?.stripeCustomerId
      ? undefined
      : (user.email ?? undefined),
    client_reference_id: String(user.id),
    metadata: {
      product_line: "appforge",
      userId: String(user.id),
      plan: tier,
      tier,
      credits: "0",
    },
    subscription_data: {
      metadata: {
        product_line: "appforge",
        userId: String(user.id),
        plan: tier,
        tier,
      },
    },
  });
  return { url: session.url };
}

function assertCanBuyTopUp(
  sub: Awaited<ReturnType<typeof getSubscriptionByUserId>>,
) {
  const active = sub?.status === "active" || sub?.status === "trialing";
  const validPeriod =
    !sub?.currentPeriodEnd || sub.currentPeriodEnd > new Date();
  const tier = sub?.tier;
  const paidTier = tier === "starter" || tier === "builder" || tier === "studio";
  if (!active || !validPeriod || !paidTier) {
    throw new Error(
      "Additional credits require an active paid AppForge plan. Explore accounts must subscribe before purchasing build credits.",
    );
  }
}

export async function createCreditCheckout(
  user: CheckoutUser,
  credits: CreditPack,
) {
  const stripe = await getStripe();
  const appUrl = requireAppUrl();
  const sub = await getSubscriptionByUserId(user.id);
  assertCanBuyTopUp(sub);
  const priceId = requireCreditPriceId(credits);
  const price = await stripe.prices.retrieve(priceId);
  assertAppForgePrice(
    price,
    TOPUP_USD_CENTS[credits],
    "one_time",
    process.env.NODE_ENV === "production",
  );
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard?checkout=success`,
    cancel_url: `${appUrl}/pricing?checkout=cancelled`,
    customer: sub?.stripeCustomerId ?? undefined,
    customer_email: sub?.stripeCustomerId
      ? undefined
      : (user.email ?? undefined),
    client_reference_id: String(user.id),
    metadata: {
      product_line: "appforge",
      userId: String(user.id),
      plan: "",
      tier: "",
      credits: String(credits),
    },
    payment_intent_data: {
      metadata: {
        product_line: "appforge",
        userId: String(user.id),
        credits: String(credits),
      },
    },
  });
  return { url: session.url };
}
