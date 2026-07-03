import Stripe from "stripe";
import { db } from "../db.js";
import { subscriptions } from "../db/schema.js";
import { eq } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-06-20",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

export async function stripeWebhookHandler(req: any, res: any) {
  const signature = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      webhookSecret
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return res.status(400).json({ error: "Invalid signature" });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId as string;

      if (userId) {
        await db
          .insert(subscriptions)
          .values({
            userId: parseInt(userId),
            stripeCustomerId: subscription.customer as string,
            stripeSubscriptionId: subscription.id,
            status: subscription.status,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          })
          .onConflictDoUpdate({
            target: [subscriptions.userId],
            set: {
              status: subscription.status,
              currentPeriodEnd: new Date(
                subscription.current_period_end * 1000
              ),
            },
          });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId as string;

      if (userId) {
        await db
          .update(subscriptions)
          .set({ status: "canceled" })
          .where(eq(subscriptions.userId, parseInt(userId)));
      }
      break;
    }

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId as string;

      if (userId && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        );

        await db
          .insert(subscriptions)
          .values({
            userId: parseInt(userId),
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: subscription.id,
            status: subscription.status,
            currentPeriodEnd: new Date(
              subscription.current_period_end * 1000
            ),
          })
          .onConflictDoUpdate({
            target: [subscriptions.userId],
            set: {
              status: subscription.status,
              currentPeriodEnd: new Date(
                subscription.current_period_end * 1000
              ),
            },
          });
      }
      break;
    }
  }

  res.json({ received: true });
}
