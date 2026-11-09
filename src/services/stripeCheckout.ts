import { getSubscriptionByUserId } from "../db.js";
import { getAppForgeStripe } from "./appForgeStripe.js";
import { assertEligibleForCreditTopUp } from "./appForgeCreditEligibility.js";
import { assertCommercialCheckoutReleased } from "./appForgeCommercialCheckoutGate.js";
import {
  assertAppForgePrice,
  APPROVED_MONTHLY_PRICE_IDS,
  AFTERCARE_PLUS_PRICE_ID,
  AFTERCARE_PLUS_USD_CENTS,
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

// Only the owner-approved live catalogue can create new plan subscriptions.
// Historical env IDs are handled by webhook compatibility, never checkout.
const PLAN_PRICE_IDS: Record<SelfServePlanTier, string> =
  APPROVED_MONTHLY_PRICE_IDS;

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

/**
 * Resolve the already-existing AppForge subscription Price by product ownership,
 * plan metadata, and the exact approved amount. No Stripe objects are created.
 * An ambiguous catalogue fails closed instead of picking an arbitrary charge.
 */
export async function resolvePlanCheckoutPrice(
  stripe: Awaited<ReturnType<typeof getStripe>>,
  tier: SelfServePlanTier,
): Promise<string> {
  const configuredId = PLAN_PRICE_IDS[tier];
  if (configuredId) {
    const configured = await stripe.prices.retrieve(configuredId);
    assertAppForgePrice(
      configured,
      MONTHLY_PLAN_USD_CENTS[tier],
      "recurring",
      process.env.NODE_ENV === "production",
    );
    return configured.id;
  }

  const matchingIds: string[] = [];
  for await (const price of stripe.prices.list({
    active: true,
    currency: "usd",
    type: "recurring",
    limit: 100,
    expand: ["data.product"],
  })) {
    const product =
      typeof price.product === "string"
        ? await stripe.products.retrieve(price.product)
        : price.product;
    if (
      !("metadata" in product) ||
      !product.active ||
      product.metadata?.product_line !== "appforge" ||
      product.metadata?.plan !== tier
    ) {
      continue;
    }
    try {
      assertAppForgePrice(
        price,
        MONTHLY_PLAN_USD_CENTS[tier],
        "recurring",
        process.env.NODE_ENV === "production",
      );
      matchingIds.push(price.id);
    } catch {
      // Other historical prices for this tier must not be selected.
    }
    if (matchingIds.length > 1) break;
  }
  if (matchingIds.length !== 1) {
    throw new Error(
      `Expected exactly one active matching AppForge ${tier} Stripe Price; found ${matchingIds.length}. Configure the intended Price ID explicitly.`,
    );
  }
  return matchingIds[0];
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

// prettier-ignore
export async function createPlanCheckout(
  user: CheckoutUser,
  tier: SelfServePlanTier,
  aftercarePlus = false,
) {
  assertCommercialCheckoutReleased();
  const stripe = await getStripe();
  const appUrl = requireAppUrl();
  const sub = await getSubscriptionByUserId(user.id);
  assertCanCreateSubscription(sub);
  const priceId = await resolvePlanCheckoutPrice(stripe, tier);

  const lineItems = [{ price: priceId, quantity: 1 }];
  if (aftercarePlus) {
    const aftercarePrice = await stripe.prices.retrieve(AFTERCARE_PLUS_PRICE_ID);
    assertAppForgePrice(
      aftercarePrice,
      AFTERCARE_PLUS_USD_CENTS,
      "recurring",
      process.env.NODE_ENV === "production",
    );
    lineItems.push({ price: AFTERCARE_PLUS_PRICE_ID, quantity: 1 });
  }
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: lineItems,
    automatic_tax: { enabled: true },
    allow_promotion_codes: false,
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
      aftercarePlus: aftercarePlus ? "true" : "false",
    },
    subscription_data: {
      metadata: {
        product_line: "appforge",
        userId: String(user.id),
        plan: tier,
        tier,
        aftercarePlus: aftercarePlus ? "true" : "false",
      },
    },
  });
  return { url: session.url };
}

export async function createCreditCheckout(
  user: CheckoutUser,
  credits: CreditPack,
) {
  assertCommercialCheckoutReleased();
  const stripe = await getStripe();
  const appUrl = requireAppUrl();
  const sub = await getSubscriptionByUserId(user.id);
  assertEligibleForCreditTopUp(sub);
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
