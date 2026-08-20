import Stripe from "stripe";
import { db } from "../db";
import { subscriptions } from "../db/schema";
import { eq } from "drizzle-orm";

// stripe@^14 typings pin apiVersion to 2023-10-16
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

export async function stripeWebhookHandler(req: any, res: any) {
  const signature = req.headers["stripe-signature"];
  let event: Stripe.Event;

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
            userId: parseInt(userId, 10),
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
          .where(eq(subscriptions.userId, parseInt(userId, 10)));
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
            userId: parseInt(userId, 10),
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
