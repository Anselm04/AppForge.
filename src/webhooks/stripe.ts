import Stripe from "stripe";
import type { Request, Response } from "express";
import { addCredits, db, grantPlanCredits } from "../db.js";
import { subscriptions, users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { CREDIT_PACKS } from "../services/stripeCheckout.js";
import { processStripeEventOnce } from "../services/stripeEventLedger.js";
import { logger } from "../_core/logger.js";

const secretKey = process.env.STRIPE_SECRET_KEY || "";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

if (process.env.NODE_ENV === "production" && (!secretKey || !webhookSecret)) {
  logger.error({}, "stripe_production_secrets_missing");
  process.exit(1);
}

const stripe = new Stripe(secretKey, {
  apiVersion: "2024-06-20" as any,
});

const PAID_TIERS = new Set([
  "starter",
  "builder",
  "studio",
  "enterprise",
  "custom",
]);
const CREDIT_PACK_SET = new Set<number>(CREDIT_PACKS);

type StandardTier = "starter" | "builder" | "studio" | "enterprise";

function parsePositiveUserId(value?: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const userId = Number(value);
  return Number.isSafeInteger(userId) && userId > 0 ? userId : null;
}

function resolveCheckoutUserId(session: Stripe.Checkout.Session): number | null {
  const metadataUserId = parsePositiveUserId(session.metadata?.userId);
  const referenceUserId = parsePositiveUserId(session.client_reference_id);

  if (
    metadataUserId !== null &&
    referenceUserId !== null &&
    metadataUserId !== referenceUserId
  ) {
    throw new Error("Stripe checkout user reference mismatch");
  }

  return metadataUserId ?? referenceUserId;
}

function parseCreditPack(value?: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const credits = Number(value);
  return CREDIT_PACK_SET.has(credits) ? credits : null;
}

function customerIdFromSubscription(
  subscription: Stripe.Subscription,
): string | null {
  return typeof subscription.customer === "string"
    ? subscription.customer
    : null;
}

function priceIdsForTier(tier: StandardTier): string[] {
  const envKeys: Record<StandardTier, string[]> = {
    starter: ["STRIPE_STARTER_PRICE_ID", "STRIPE_PRICE_STARTER"],
    builder: ["STRIPE_BUILDER_PRICE_ID", "STRIPE_PRICE_BUILDER"],
    studio: ["STRIPE_STUDIO_PRICE_ID", "STRIPE_PRICE_STUDIO"],
    enterprise: ["STRIPE_ENTERPRISE_PRICE_ID", "STRIPE_PRICE_ENTERPRISE"],
  };
  return envKeys[tier].map((k) => process.env[k] || "").filter(Boolean);
}

function tierFromPriceId(priceId?: string | null): StandardTier | null {
  if (!priceId) return null;
  for (const tier of ["starter", "builder", "studio", "enterprise"] as const) {
    if (priceIdsForTier(tier).includes(priceId)) return tier;
  }
  return null;
}

function resolveTier(
  meta?: Stripe.Metadata | null,
  priceId?: string | null,
): string {
  const fromMeta = (meta?.tier || meta?.plan || "").toLowerCase();
  const mappedTier = tierFromPriceId(priceId);

  // The configured Stripe price is authoritative. Customer Portal plan changes
  // update the subscription price but can leave the subscription metadata on the
  // previous tier. Rejecting that normal stale metadata would take payment while
  // failing to provision the customer's new entitlement.
  if (mappedTier) {
    if (fromMeta && PAID_TIERS.has(fromMeta) && fromMeta !== mappedTier) {
      logger.warn(
        { metadataTier: fromMeta, mappedTier, priceId },
        "stripe_tier_metadata_stale_using_price",
      );
    }
    return mappedTier;
  }

  if (fromMeta === "custom") return fromMeta;

  throw new Error(
    `Unrecognized Stripe price; refusing to provision access: ${priceId || "missing"}`,
  );
}

function subscriptionPriceId(subscription: Stripe.Subscription): string | null {
  return subscription.items?.data?.[0]?.price?.id ?? null;
}

async function upsertSubscription(opts: {
  userId: number;
  customerId: string;
  subscription: Stripe.Subscription;
  tier: string;
}) {
  const { userId, customerId, subscription, tier } = opts;
  const trialEnd =
    subscription.status === "trialing" && subscription.trial_end
      ? new Date(subscription.trial_end * 1000)
      : null;
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : null;

  await db
    .insert(subscriptions)
    .values({
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      tier,
      trialEnd,
      currentPeriodEnd: periodEnd,
    })
    .onConflictDoUpdate({
      target: [subscriptions.userId],
      set: {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        status: subscription.status,
        tier,
        trialEnd,
        currentPeriodEnd: periodEnd,
        updatedAt: new Date(),
      },
    });
}

async function resolveUserIdFromCustomer(
  customerId: string | null,
): Promise<number | undefined> {
  if (!customerId) return undefined;
  const existing = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.stripeCustomerId, customerId),
  });
  return existing?.userId ?? undefined;
}

async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = customerIdFromSubscription(subscription);
      let userId = parsePositiveUserId(subscription.metadata?.userId) ?? undefined;
      const priceId = subscriptionPriceId(subscription);
      const tier = resolveTier(subscription.metadata, priceId);

      if (!userId && customerId) {
        userId = await resolveUserIdFromCustomer(customerId);
      }

      if (userId && customerId) {
        await upsertSubscription({
          userId,
          customerId,
          subscription,
          tier,
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = customerIdFromSubscription(subscription);
      let userId = parsePositiveUserId(subscription.metadata?.userId) ?? undefined;
      if (!userId && customerId) {
        userId = await resolveUserIdFromCustomer(customerId);
      }

      if (userId) {
        await db
          .update(subscriptions)
          .set({ status: "canceled", tier: "free", updatedAt: new Date() })
          .where(eq(subscriptions.userId, userId));
      }
      break;
    }

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = resolveCheckoutUserId(session);
      const mode = session.mode;

      if (userId && mode === "subscription" && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string,
        );
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : customerIdFromSubscription(subscription);
        if (!customerId) {
          throw new Error("Stripe subscription customer is missing");
        }
        const priceId = subscriptionPriceId(subscription);
        const tier = resolveTier(
          { ...(subscription.metadata || {}), ...(session.metadata || {}) },
          priceId,
        );

        await upsertSubscription({
          userId,
          customerId,
          subscription,
          tier,
        });

        const result = await grantPlanCredits(
          userId,
          tier,
          `checkout-${session.id}`,
        );
        if (!result.skipped) {
          logger.info(
            { userId, tier, creditsGranted: result.granted, eventId: event.id },
            "stripe_checkout_plan_credits_granted",
          );
        }
      }

      if (userId && mode === "payment" && session.payment_status === "paid") {
        const credits = parseCreditPack(session.metadata?.credits);
        if (credits !== null) {
          const paymentRef =
            (session.payment_intent as string) || `checkout-${session.id}`;
          await addCredits(
            userId,
            credits,
            "purchase",
            `Stripe checkout credit purchase (${credits} credits)`,
            paymentRef,
          );
          logger.info(
            { userId, credits, eventId: event.id },
            "stripe_credit_purchase_processed",
          );
        } else {
          throw new Error("Unrecognized Stripe credit pack metadata");
        }
      }
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string | undefined;
      if (subscriptionId) {
        const existing = await db.query.subscriptions.findFirst({
          where: eq(subscriptions.stripeSubscriptionId, subscriptionId),
        });

        await db
          .update(subscriptions)
          .set({ status: "active", updatedAt: new Date() })
          .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));

        let userId = existing?.userId;
        let tier = existing?.tier;

        if (!userId || !tier) {
          try {
            const subscription =
              await stripe.subscriptions.retrieve(subscriptionId);
            const customerId = customerIdFromSubscription(subscription);
            const priceId = subscriptionPriceId(subscription);
            tier = resolveTier(subscription.metadata, priceId);
            const fromCustomer = await resolveUserIdFromCustomer(customerId);
            const fromMeta = parsePositiveUserId(subscription.metadata?.userId);
            const resolved = fromMeta ?? fromCustomer;
            if (resolved && customerId) {
              userId = resolved;
              await upsertSubscription({
                userId,
                customerId,
                subscription,
                tier,
              });
            }
          } catch (lookupErr) {
            logger.error(
              { error: lookupErr, eventId: event.id },
              "stripe_invoice_subscription_lookup_failed",
            );
          }
        }

        if (userId && tier) {
          const result = await grantPlanCredits(userId, tier, invoice.id);
          if (!result.skipped) {
            logger.info(
              { userId, tier, creditsGranted: result.granted, eventId: event.id },
              "stripe_invoice_plan_credits_granted",
            );
          }
        }
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string | undefined;
      if (subscriptionId) {
        await db
          .update(subscriptions)
          .set({ status: "past_due", updatedAt: new Date() })
          .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));
      }
      break;
    }

    default:
      break;
  }
}

export async function handleStripeWebhook(req: Request, res: Response) {
  if (!webhookSecret) {
    return res.status(500).json({ error: "Stripe webhook not configured" });
  }

  const signature = req.headers["stripe-signature"];
  if (!signature || typeof signature !== "string") {
    return res.status(400).json({ error: "Missing Stripe signature" });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (error) {
    logger.warn({ error }, "stripe_webhook_signature_invalid");
    return res.status(400).json({ error: "Invalid Stripe signature" });
  }

  try {
    await processStripeEventOnce(event.id, event.type, () =>
      handleStripeEvent(event),
    );
    return res.json({ received: true });
  } catch (error) {
    logger.error(
      { error, eventId: event.id, eventType: event.type },
      "stripe_webhook_processing_failed",
    );
    return res.status(500).json({ error: "Webhook processing failed" });
  }
}
