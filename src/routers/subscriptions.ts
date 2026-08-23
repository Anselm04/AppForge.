import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSubscriptionByUserId, isUserPro, getUserCredits, countBuildsThisMonth } from "../db.js";
import { protectedProcedure, router } from "../_core/trpc.js";
import { ENV } from "../_core/env.js";

const TIER_PRICE_IDS: Record<string, string> = {
  starter: process.env.STRIPE_STARTER_PRICE_ID || "",
  builder: process.env.STRIPE_BUILDER_PRICE_ID || "",
  studio: process.env.STRIPE_STUDIO_PRICE_ID || "",
  enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID || "",
  custom: process.env.STRIPE_CUSTOM_PRICE_ID || "",
};

const TIER_PAYMENT_LINKS: Record<string, string> = {
  starter: process.env.STRIPE_STARTER_PAYMENT_LINK || "",
  builder: process.env.STRIPE_BUILDER_PAYMENT_LINK || "",
  studio: process.env.STRIPE_STUDIO_PAYMENT_LINK || "",
};

const TIER_LIMITS: Record<string, number | null> = {
  free: 3,
  starter: 16,
  builder: 66,
  studio: null, // unlimited
  enterprise: null,
  custom: null,
};

async function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe not configured" });
  const { default: Stripe } = await import("stripe");
  return new Stripe(key, { apiVersion: "2024-06-20" });
}

function getPriceId(tier: string): string {
  const id = TIER_PRICE_IDS[tier];
  if (!id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Stripe price ID not configured for tier: ${tier}` });
  return id;
}

export const subscriptionsRouter = router({
  status: protectedProcedure.query(async ({ ctx }) => {
    const sub = await getSubscriptionByUserId(ctx.user.id);
    const credits = await getUserCredits(ctx.user.id);
    const tier = sub?.tier ?? credits?.tier ?? "free";
    const isPaid = tier !== "free" && (sub?.status === "active" || sub?.status === "trialing");
    const buildsThisMonth = await countBuildsThisMonth(ctx.user.id);
    const limit = TIER_LIMITS[tier] ?? TIER_LIMITS.free;
    return {
      tier,
      isPaid,
      isTrialing: sub?.status === "trialing",
      trialEnd: sub?.trialEnd ?? null,
      status: sub?.status ?? "none",
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
      stripeCustomerId: sub?.stripeCustomerId ?? null,
      buildsThisMonth,
      limit,
      remaining: limit !== null ? Math.max(0, limit - buildsThisMonth) : null,
      credits: credits?.balance ?? 0,
    };
  }),

  getPaymentLink: protectedProcedure
    .input(z.object({
      tier: z.enum(["starter", "builder", "studio"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const link = TIER_PAYMENT_LINKS[input.tier];
      if (!link) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Payment link not configured for tier: ${input.tier}` });
      const url = new URL(link);
      url.searchParams.set("client_reference_id", String(ctx.user.id));
      url.searchParams.set("prefilled_email", ctx.user.email ?? "");
      return { url: url.toString() };
    }),

  createCheckoutSession: protectedProcedure
    .input(z.object({
      tier: z.enum(["starter", "builder", "studio", "enterprise", "custom"]),
      successUrl: z.string().url(),
      cancelUrl: z.string().url(),
      trialDays: z.number().int().min(0).max(30).optional().default(7),
    }))
    .mutation(async ({ ctx, input }) => {
      const stripe = await getStripe();
      const sub = await getSubscriptionByUserId(ctx.user.id);
      const priceId = getPriceId(input.tier);

      const sessionPayload: any = {
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        customer: sub?.stripeCustomerId ?? undefined,
        customer_email: sub?.stripeCustomerId ? undefined : (ctx.user.email ?? undefined),
        metadata: { userId: String(ctx.user.id), tier: input.tier },
        subscription_data: {
          trial_period_days: input.trialDays,
          metadata: { userId: String(ctx.user.id), tier: input.tier },
        },
      };

      const session = await stripe.checkout.sessions.create(sessionPayload);
      return { url: session.url };
    }),

  billingPortal: protectedProcedure
    .input(z.object({ returnUrl: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      const stripe = await getStripe();
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
