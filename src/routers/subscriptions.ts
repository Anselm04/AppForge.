import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  getSubscriptionByUserId,
  getUserCredits,
  countBuildsThisMonth,
} from "../db.js";
import { protectedProcedure, router } from "../_core/trpc.js";

const APP_URL =
  process.env.PUBLIC_APP_URL || "https://appforge-unfurling-moon-9058.fly.dev";

const PLAN_TIERS = ["starter", "builder", "studio", "enterprise"] as const;
type PlanTier = (typeof PLAN_TIERS)[number];

const CREDIT_PACKS = [50, 100, 250] as const;
type CreditPack = (typeof CREDIT_PACKS)[number];

const TIER_PRICE_IDS: Record<PlanTier, string> = {
  starter:
    process.env.STRIPE_STARTER_PRICE_ID || process.env.STRIPE_PRICE_STARTER || "",
  builder:
    process.env.STRIPE_BUILDER_PRICE_ID || process.env.STRIPE_PRICE_BUILDER || "",
  studio:
    process.env.STRIPE_STUDIO_PRICE_ID || process.env.STRIPE_PRICE_STUDIO || "",
  enterprise:
    process.env.STRIPE_ENTERPRISE_PRICE_ID ||
    process.env.STRIPE_PRICE_ENTERPRISE ||
    "",
};

const CREDIT_PRICE_IDS: Record<CreditPack, string> = {
  50:
    process.env.STRIPE_CREDITS_50_PRICE_ID ||
    "price_1UB11YKFfiU4ONpq9lxQxD0t",
  100:
    process.env.STRIPE_CREDITS_100_PRICE_ID ||
    "price_1UB11YKFfiU4ONpqxG2boP66",
  250:
    process.env.STRIPE_CREDITS_250_PRICE_ID ||
    "price_1UB11ZKFfiU4ONpq3bUBdUuS",
};

const TIER_LIMITS: Record<string, number | null> = {
  free: 3,
  starter: 16,
  builder: 66,
  studio: null,
  enterprise: null,
};

async function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Stripe not configured",
    });
  }
  const { default: Stripe } = await import("stripe");
  return new Stripe(key, { apiVersion: "2024-06-20" as any });
}

function getPriceId(tier: PlanTier): string {
  const id = TIER_PRICE_IDS[tier];
  if (!id) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Stripe price ID not configured for tier: ${tier}`,
    });
  }
  return id;
}

function getCreditPriceId(credits: CreditPack): string {
  const id = CREDIT_PRICE_IDS[credits];
  if (!id) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Stripe price ID not configured for credit pack: ${credits}`,
    });
  }
  return id;
}

export const subscriptionsRouter = router({
  status: protectedProcedure.query(async ({ ctx }) => {
    const sub = await getSubscriptionByUserId(ctx.user.id);
    const credits = await getUserCredits(ctx.user.id);
    const tier = sub?.tier ?? credits?.tier ?? "free";
    const isPaid =
      tier !== "free" &&
      (sub?.status === "active" || sub?.status === "trialing");
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
      remaining:
        limit !== null ? Math.max(0, limit - buildsThisMonth) : null,
      credits: credits?.balance ?? 0,
    };
  }),

  createCheckoutSession: protectedProcedure
    .input(
      z.object({
        tier: z.enum(PLAN_TIERS),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const stripe = await getStripe();
      const sub = await getSubscriptionByUserId(ctx.user.id);
      const priceId = getPriceId(input.tier);

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${APP_URL}/dashboard?checkout=success`,
        cancel_url: `${APP_URL}/pricing?checkout=cancelled`,
        customer: sub?.stripeCustomerId ?? undefined,
        customer_email: sub?.stripeCustomerId
          ? undefined
          : (ctx.user.email ?? undefined),
        client_reference_id: String(ctx.user.id),
        metadata: {
          userId: String(ctx.user.id),
          plan: input.tier,
          tier: input.tier,
        },
        subscription_data: {
          metadata: {
            userId: String(ctx.user.id),
            plan: input.tier,
            tier: input.tier,
          },
        },
      });

      return { url: session.url };
    }),

  buyCredits: protectedProcedure
    .input(
      z.object({
        credits: z.union([
          z.literal(50),
          z.literal(100),
          z.literal(250),
        ]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const stripe = await getStripe();
      const sub = await getSubscriptionByUserId(ctx.user.id);
      const priceId = getCreditPriceId(input.credits);

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${APP_URL}/dashboard?checkout=success`,
        cancel_url: `${APP_URL}/pricing?checkout=cancelled`,
        client_reference_id: String(ctx.user.id),
        metadata: {
          userId: String(ctx.user.id),
          credits: String(input.credits),
          plan: "",
          tier: "",
        },
        customer: sub?.stripeCustomerId ?? undefined,
        customer_email: sub?.stripeCustomerId
          ? undefined
          : (ctx.user.email ?? undefined),
      });

      return { url: session.url };
    }),

  billingPortal: protectedProcedure.mutation(async ({ ctx }) => {
    const stripe = await getStripe();
    const sub = await getSubscriptionByUserId(ctx.user.id);

    if (!sub?.stripeCustomerId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No Stripe customer found",
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${APP_URL}/dashboard`,
    });

    return { url: session.url };
  }),
});
