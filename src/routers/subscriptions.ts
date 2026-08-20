import { TRPCError } from "@trpc/server";
import { z } from "zod";
import Stripe from "stripe";
import { getSubscriptionByUserId, isUserPro } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Stripe not configured",
    });
  }
  return new Stripe(key, { apiVersion: "2023-10-16" });
}

export const subscriptionsRouter = router({
  status: protectedProcedure.query(async ({ ctx }) => {
    const sub = await getSubscriptionByUserId(ctx.user.id);
    const isPro = await isUserPro(ctx.user.id);
    return {
      isPro,
      status: sub?.status ?? "none",
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
      stripeCustomerId: sub?.stripeCustomerId ?? null,
    };
  }),

  createCheckout: protectedProcedure
    .input(
      z.object({
        priceId: z.string(),
        successUrl: z.string().url(),
        cancelUrl: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const stripe = getStripe();
      const sub = await getSubscriptionByUserId(ctx.user.id);
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: input.priceId, quantity: 1 }],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        customer: sub?.stripeCustomerId ?? undefined,
        customer_email: sub?.stripeCustomerId
          ? undefined
          : ctx.user.email || undefined,
        metadata: { userId: String(ctx.user.id) },
        subscription_data: {
          trial_period_days: 7,
          metadata: { userId: String(ctx.user.id) },
        },
      });
      if (!session.url) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Stripe did not return a checkout URL",
        });
      }
      return { url: session.url };
    }),

  billingPortal: protectedProcedure
    .input(z.object({ returnUrl: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      const stripe = getStripe();
      const sub = await getSubscriptionByUserId(ctx.user.id);
      if (!sub?.stripeCustomerId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No Stripe customer found",
        });
      }
      const session = await stripe.billingPortal.sessions.create({
        customer: sub.stripeCustomerId,
        return_url: input.returnUrl,
      });
      return { url: session.url };
    }),
});
