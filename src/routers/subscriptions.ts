import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSubscriptionByUserId, isUserPro } from "../db.js";
import { protectedProcedure, router } from "../_core/trpc.js";
import { ENV } from "../_core/env.js";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe not configured" });
  // Dynamic import to avoid crash when key is missing
  const Stripe = require("stripe");
  return new Stripe(key, { apiVersion: "2024-06-20" });
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
    .input(z.object({ priceId: z.string(), successUrl: z.string(), cancelUrl: z.string() }))
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
        customer_email: sub?.stripeCustomerId ? undefined : (ctx.user.email ?? undefined),
        metadata: { userId: String(ctx.user.id) },
      });
      return { url: session.url };
    }),

  billingPortal: protectedProcedure
    .input(z.object({ returnUrl: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const stripe = getStripe();
      const sub = await getSubscriptionByUserId(ctx.user.id);
      if (!sub?.stripeCustomerId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No Stripe customer found" });
      }
      const session = await stripe.billingPortal.sessions.create({
        customer: sub.stripeCustomerId,
        return_url: input.returnUrl,
      });
      return { url: session.url };
    }),
});
