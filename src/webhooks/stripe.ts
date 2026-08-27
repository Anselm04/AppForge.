import Stripe from "stripe";
import type { Request, Response } from "express";
import { db, grantPlanCredits, addCredits } from "../db.js";
import { subscriptions, users } from "../db/schema.js";
import { eq } from "drizzle-orm";

const secretKey = process.env.STRIPE_SECRET_KEY || "";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

// Harden: refuse to initialize if secrets are missing in production
if (process.env.NODE_ENV === "production" && (!secretKey || !webhookSecret)) {
  console.error("FATAL: Stripe secrets (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET) are required in production");
  process.exit(1);
}

// Stripe SDK v14 — use `as any` to bypass strict enum typing since the SDK
// pins to a specific date and the source file is already using 2024-06-20.
const stripe = new Stripe(secretKey, {
  apiVersion: "2024-06-20" as any,
});

const PAID_TIERS = new Set(["starter", "builder", "studio", "enterprise", "custom"]);

function priceIdsForTier(tier: "starter" | "builder" | "studio"): string[] {
  const envKeys: Record<typeof tier, string[]> = {
    starter: ["STRIPE_STARTER_PRICE_ID", "STRIPE_PRICE_STARTER"],
    builder: ["STRIPE_BUILDER_PRICE_ID", "STRIPE_PRICE_BUILDER"],
    studio: ["STRIPE_STUDIO_PRICE_ID", "STRIPE_PRICE_STUDIO"],
  };
  return envKeys[tier].map((k) => process.env[k] || "").filter(Boolean);
}

function tierFromPriceId(priceId?: string | null): string | null {
  if (!priceId) return null;
  for (const tier of ["starter", "builder", "studio"] as const) {
    if (priceIdsForTier(tier).includes(priceId)) return tier;
  }
  return null;
}

function resolveTier(
  meta?: Stripe.Metadata | null,
  priceId?: string | null
): string {
  const fromMeta = (meta?.tier || meta?.plan || "").toLowerCase();
  if (fromMeta && PAID_TIERS.has(fromMeta)) return fromMeta;
  return tierFromPriceId(priceId) ?? "starter";
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

async function resolveUserIdFromCustomer(customerId: string | null): Promise<string | undefined> {
  if (!customerId) return undefined;
  const existing = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.stripeCustomerId, customerId),
  });
  return existing ? String(existing.userId) : undefined;
}

export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  const signature = req.headers["stripe-signature"] as string | undefined;

  // Guard: no secret configured -> reject immediately
  if (!webhookSecret) {
    console.error("Stripe webhook rejected: STRIPE_WEBHOOK_SECRET not configured");
    res.status(500).json({ error: "Webhook secret not configured" });
    return;
  }

  // Guard: missing signature -> 400
  if (!signature) {
    console.error("Stripe webhook rejected: missing stripe-signature header");
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    res.status(400).json({ error: "Invalid signature", detail: err.message });
    return;
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      let userId: string | undefined = subscription.metadata?.userId;
      const priceId = subscriptionPriceId(subscription);
      const tier = resolveTier(subscription.metadata, priceId);

      if (!userId && subscription.customer) {
        userId = await resolveUserIdFromCustomer(subscription.customer as string);
      }

      if (userId) {
        await upsertSubscription({
          userId: parseInt(userId, 10),
          customerId: subscription.customer as string,
          subscription,
          tier,
        });
        // Credits are granted on checkout.session.completed and invoice.paid,
        // not on every subscription.updated (Stripe sends those often).
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      let userId: string | undefined = subscription.metadata?.userId;
      if (!userId && subscription.customer) {
        userId = await resolveUserIdFromCustomer(subscription.customer as string);
      }

      if (userId) {
        await db
          .update(subscriptions)
          .set({ status: "canceled", tier: "free", updatedAt: new Date() })
          .where(eq(subscriptions.userId, parseInt(userId, 10)));
      }
      break;
    }

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId ?? session.client_reference_id;
      const mode = session.mode;

      if (userId && mode === "subscription" && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        const priceId = subscriptionPriceId(subscription);
        const tier = resolveTier(
          { ...(subscription.metadata || {}), ...(session.metadata || {}) },
          priceId
        );

        await upsertSubscription({
          userId: parseInt(userId, 10),
          customerId: (session.customer || subscription.customer) as string,
          subscription,
          tier,
        });

        const result = await grantPlanCredits(
          parseInt(userId, 10),
          tier,
          `checkout-${session.id}`
        );
        if (!result.skipped) {
          console.log(`Granted ${result.granted} ${tier} credits to user ${userId} from checkout`);
        }
      }

      if (userId && mode === "payment") {
        const credits = parseInt(session.metadata?.credits || "0", 10);
        if (credits > 0) {
          const paymentRef = (session.payment_intent as string) || `checkout-${session.id}`;
          await addCredits(
            parseInt(userId, 10),
            credits,
            "purchase",
            `Stripe checkout credit purchase (${credits} credits)`,
            paymentRef
          );
          console.log(`Added ${credits} extra credits to user ${userId}`);
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
        let tier = existing?.tier ?? "starter";

        if (!userId) {
          try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const priceId = subscriptionPriceId(subscription);
            tier = resolveTier(subscription.metadata, priceId);
            const fromCustomer = await resolveUserIdFromCustomer(subscription.customer as string);
            const fromMeta = subscription.metadata?.userId;
            const resolved = fromMeta || fromCustomer;
            if (resolved) {
              userId = parseInt(resolved, 10);
              await upsertSubscription({
                userId,
                customerId: subscription.customer as string,
                subscription,
                tier,
              });
            }
          } catch (lookupErr) {
            console.error("invoice.paid subscription lookup failed:", lookupErr);
          }
        }

        if (userId) {
          const result = await grantPlanCredits(userId, tier ?? "starter", invoice.id);
          if (!result.skipped) {
            console.log(`Invoice ${invoice.id} granted ${result.granted} ${tier} credits to user ${userId}`);
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
        console.warn(`Invoice payment failed for subscription ${subscriptionId}, status set to past_due`);
        try {
          const { notifyPaymentFailed } = await import("../services/email.js");
          const userEmail = await db.select({ email: users.email })
            .from(users)
            .innerJoin(subscriptions, eq(subscriptions.stripeSubscriptionId, subscriptionId))
            .limit(1);
          if (userEmail[0]?.email) {
            await notifyPaymentFailed(userEmail[0].email);
          }
        } catch (emailErr) {
          console.error("Failed to send payment failure email:", emailErr);
        }
      }
      break;
    }

    default: {
      console.log(`Unhandled Stripe webhook event: ${event.type}`);
    }
  }

  res.json({ received: true });
}
