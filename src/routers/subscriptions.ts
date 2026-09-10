import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  getSubscriptionByUserId,
  getUserCredits,
  getUserTier,
  countBuildsThisMonth,
} from "../db.js";
import { protectedProcedure, router } from "../_core/trpc.js";
import {
  createCreditCheckout,
  createPlanCheckout,
  CREDIT_PACKS,
} from "../services/stripeCheckout.js";

const CHECKOUT_TIERS = ["starter", "builder", "studio", "enterprise"] as const;

const TIER_LIMITS: Record<string, number | null> = {
  free: 3,
  starter: 16,
  builder: 66,
  studio: null,
  enterprise: null,
  custom: null,
  lifetime: null,
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

export const subscriptionsRouter = router({
  status: protectedProcedure.query(async ({ ctx }) => {
    const sub = await getSubscriptionByUserId(ctx.user.id);
    const credits = await getUserCredits(ctx.user.id);
    const activeSubscriptionTier = await getUserTier(ctx.user.id);
    const hasLifetimeAccess =
      !!credits?.unlimited || credits?.tier === "lifetime";
    const tier = hasLifetimeAccess ? "lifetime" : activeSubscriptionTier;
    const isPaid = tier !== "free";
    const buildsThisMonth = await countBuildsThisMonth(ctx.user.id);
    const limit = TIER_LIMITS[tier] ?? TIER_LIMITS.free;

    return {
      tier,
      isPaid,
      isTrialing: sub?.status === "trialing" && tier !== "free",
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

  createCheckoutSession: protectedProcedure
    .input(
      z.object({
        tier: z.enum(CHECKOUT_TIERS),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.tier === "enterprise") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Enterprise plans are sales-led. Contact AppForge for provisioning.",
        });
      }

      const existing = await getSubscriptionByUserId(ctx.user.id);
      if (
        existing?.stripeCustomerId &&
        (existing.status === "active" || existing.status === "trialing")
      ) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "You already have an active subscription. Use Manage billing to change your plan without creating a second subscription.",
        });
      }

      try {
        return await createPlanCheckout(
          { id: ctx.user.id, email: ctx.user.email },
          input.tier,
        );
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Checkout failed",
        });
      }
    }),

  buyCredits: protectedProcedure
    .input(
      z.object({
        credits: z.union(CREDIT_PACKS.map((value) => z.literal(value)) as [
          z.ZodLiteral<50>,
          z.ZodLiteral<100>,
          z.ZodLiteral<250>,
        ]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await createCreditCheckout(
          { id: ctx.user.id, email: ctx.user.email },
          input.credits,
        );
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Credit checkout failed",
        });
      }
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

    const appUrl =
      process.env.PUBLIC_APP_URL ||
      "https://appforge-unfurling-moon-9058.fly.dev";
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${appUrl}/dashboard`,
    });

    return { url: session.url };
  }),
});
