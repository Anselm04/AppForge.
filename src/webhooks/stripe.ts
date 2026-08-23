import Stripe from "stripe";
import type { Request, Response } from "express";
import { db } from "../db.js";
import { subscriptions, users } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

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
      let userId = subscription.metadata?.userId;
      const tier = subscription.metadata?.tier;

      // Fallback: look up user by customer ID if metadata missing (Payment Links)
      if (!userId && subscription.customer) {
        const existing = await db.query.subscriptions.findFirst({
          where: eq(subscriptions.stripeCustomerId, subscription.customer as string),
        });
        if (existing) userId = String(existing.userId);
      }

      if (userId) {
        const trialEnd = subscription.status === "trialing" && subscription.trial_end
          ? new Date(subscription.trial_end * 1000)
          : null;

        await db
          .insert(subscriptions)
          .values({
            userId: parseInt(userId, 10),
            stripeCustomerId: subscription.customer as string,
            stripeSubscriptionId: subscription.id,
            status: subscription.status,
            tier: tier ?? "starter",
            trialEnd,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          })
          .onConflictDoUpdate({
            target: [subscriptions.userId],
            set: {
              status: subscription.status,
              tier: tier ?? "starter",
              trialEnd,
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            },
          });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;

      if (userId) {
        await db
          .update(subscriptions)
          .set({ status: "canceled", tier: "free" })
          .where(eq(subscriptions.userId, parseInt(userId, 10)));
      }
      break;
    }

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId ?? session.client_reference_id;
      const mode = session.mode;
      const tier = session.metadata?.tier ?? "starter";

      if (userId && mode === "subscription" && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        const trialEnd = subscription.status === "trialing" && subscription.trial_end
          ? new Date(subscription.trial_end * 1000)
          : null;

        await db
          .insert(subscriptions)
          .values({
            userId: parseInt(userId, 10),
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: subscription.id,
            status: subscription.status,
            tier: tier ?? "starter",
            trialEnd,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          })
          .onConflictDoUpdate({
            target: [subscriptions.userId],
            set: {
              status: subscription.status,
              tier: tier ?? "starter",
              trialEnd,
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            },
          });
      }

      if (userId && mode === "payment" && session.payment_intent) {
        // One-time credit purchase
        const credits = parseInt(session.metadata?.credits || "0", 10);
        if (credits > 0) {
          const { addCredits } = await import("../db.js");
          await addCredits(
            parseInt(userId, 10),
            credits,
            "purchase",
            `Stripe checkout credit purchase (${credits} credits)`,
            session.payment_intent as string
          );
          console.log(`✅ Added ${credits} credits to user ${userId}`);
        }
      }
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string | undefined;
      if (subscriptionId) {
        await db
          .update(subscriptions)
          .set({ status: "active", updatedAt: new Date() })
          .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));
        console.log(`✅ Invoice paid for subscription ${subscriptionId}, status set to active`);
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
        console.warn(`⚠️ Invoice payment failed for subscription ${subscriptionId}, status set to past_due`);
        // Send email notification about payment failure
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
