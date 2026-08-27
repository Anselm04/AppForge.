import { eq, desc, and, gte } from "drizzle-orm";
import * as schema from "./db/schema.js";
import { db } from "./db.js";
import { getSubscriptionByUserId, getTierBuildLimit, getTierCreditRefill } from "./dbSubs.js";

export async function getUserTier(userId: number): Promise<string> {
  const sub = await getSubscriptionByUserId(userId);
  if (sub && (sub.status === "active" || sub.status === "trialing")) {
    return sub.tier ?? "starter";
  }
  const credits = await getUserCredits(userId);
  return credits?.tier ?? "free";
}

// ── CREDITS ──
export async function getUserCredits(userId: number) {
  return db.query.userCredits.findFirst({
    where: eq(schema.userCredits.userId, userId),
  });
}

export async function ensureUserCredits(userId: number) {
  const existing = await getUserCredits(userId);
  if (existing) return existing;

  // Default free tier credits
  const result = await db
    .insert(schema.userCredits)
    .values({ userId, balance: 20, tier: "free", monthlyAllowance: 3 })
    .returning();
  return result[0];
}

export async function refillMonthlyCredits(userId: number, tier?: string): Promise<void> {
  const credits = await getUserCredits(userId);
  if (!credits) return;

  const effectiveTier = tier ?? credits.tier ?? "free";
  const refillAmount = getTierCreditRefill(effectiveTier);
  if (refillAmount === null) return; // unlimited tiers don't need refills

  const now = new Date();
  const lastRefill = credits.lastRefillAt ?? credits.createdAt ?? now;
  const daysSinceRefill = (now.getTime() - new Date(lastRefill).getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceRefill >= 30) {
    await db.transaction(async (tx) => {
      await tx
        .update(schema.userCredits)
        .set({
          balance: refillAmount,
          tier: effectiveTier,
          monthlyAllowance: getTierBuildLimit(effectiveTier) ?? 0,
          lastRefillAt: now,
          updatedAt: now,
        })
        .where(eq(schema.userCredits.id, credits.id));

      await tx.insert(schema.creditTransactions).values({
        userId,
        amount: refillAmount,
        type: "subscription_grant",
        description: `Monthly credit refill for ${effectiveTier} tier (${refillAmount} credits)`,
      });
    });
  }
}

export async function syncTierFromSubscription(userId: number): Promise<void> {
  const sub = await getSubscriptionByUserId(userId);
  const credits = await getUserCredits(userId);
  const subTier = sub?.tier;
  if (!subTier || !credits) return;
  if (credits.tier !== subTier) {
    await db
      .update(schema.userCredits)
      .set({ tier: subTier, updatedAt: new Date() })
      .where(eq(schema.userCredits.id, credits.id));
  }
}

export async function deductCredits(userId: number, amount: number, projectId?: number, description?: string) {
  const credits = await getUserCredits(userId);
  if (!credits || credits.balance < amount) {
    throw new Error(`Insufficient credits: need ${amount}, have ${credits?.balance ?? 0}`);
  }
  const newBalance = credits.balance - amount;
  if (newBalance < 0) {
    throw new Error(`Credit underflow prevented: would result in ${newBalance}`);
  }
  await db.transaction(async (tx) => {
    await tx
      .update(schema.userCredits)
      .set({ balance: newBalance, updatedAt: new Date() })
      .where(eq(schema.userCredits.id, credits.id));
    await tx.insert(schema.creditTransactions).values({
      userId,
      amount: -amount,
      type: "build_usage",
      projectId: projectId ?? null,
      description: description ?? "Build agent usage",
    });
  });
  return newBalance;
}

export async function addCredits(userId: number, amount: number, type: string, description?: string, stripePaymentIntentId?: string) {
  const credits = await getUserCredits(userId);
  const currentBalance = credits?.balance ?? 0;
  await db.transaction(async (tx) => {
    if (credits) {
      await tx
        .update(schema.userCredits)
        .set({ balance: currentBalance + amount, updatedAt: new Date() })
        .where(eq(schema.userCredits.id, credits.id));
    } else {
      await tx.insert(schema.userCredits).values({
        userId,
        balance: amount,
        tier: "free",
        monthlyAllowance: 0,
      });
    }
    await tx.insert(schema.creditTransactions).values({
      userId,
      amount,
      type,
      description: description ?? "Credit purchase",
      stripePaymentIntentId: stripePaymentIntentId ?? null,
    });
  });
  if (amount > 0) {
    await unpauseCreditExhaustedProjects(userId);
  }
  return currentBalance + amount;
}

/** Resume projects paused because the user ran out of credits. */
export async function unpauseCreditExhaustedProjects(userId: number) {
  await db
    .update(schema.projects)
    .set({ status: "pending", pauseReason: null, updatedAt: new Date() })
    .where(
      and(
        eq(schema.projects.userId, userId),
        eq(schema.projects.status, "paused"),
        eq(schema.projects.pauseReason, "credits_exhausted")
      )
    );
}

/**
 * Grant a plan's monthly credits. Idempotent per Stripe invoice/session
 * (and within a ~25 day window for the same tier) so checkout.session.completed
 * and invoice.paid can both call this without double-granting.
 */
export async function grantPlanCredits(
  userId: number,
  tier: string,
  idempotencyKey?: string
): Promise<{ granted: number; skipped: boolean }> {
  await ensureUserCredits(userId);
  const credits = await getUserCredits(userId);
  if (!credits) return { granted: 0, skipped: true };

  if (idempotencyKey) {
    const existing = await db.query.creditTransactions.findFirst({
      where: and(
        eq(schema.creditTransactions.userId, userId),
        eq(schema.creditTransactions.stripePaymentIntentId, idempotencyKey)
      ),
    });
    if (existing) {
      await unpauseCreditExhaustedProjects(userId);
      return { granted: 0, skipped: true };
    }
  }

  const refillAmount = getTierCreditRefill(tier);
  const now = new Date();
  const recentGrant = await db.query.creditTransactions.findFirst({
    where: and(
      eq(schema.creditTransactions.userId, userId),
      eq(schema.creditTransactions.type, "subscription_grant")
    ),
    orderBy: desc(schema.creditTransactions.createdAt),
  });
  if (recentGrant?.createdAt && refillAmount !== null) {
    const daysSinceGrant =
      (now.getTime() - new Date(recentGrant.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    const samePaidTier = (credits.tier ?? "free") === tier && tier !== "free";
    // Same paid plan already granted this period (checkout + invoice race).
    if (samePaidTier && daysSinceGrant < 25) {
      await unpauseCreditExhaustedProjects(userId);
      return { granted: 0, skipped: true };
    }
  }

  if (refillAmount === null) {
    await db
      .update(schema.userCredits)
      .set({
        tier,
        monthlyAllowance: getTierBuildLimit(tier) ?? 0,
        lastRefillAt: now,
        updatedAt: now,
      })
      .where(eq(schema.userCredits.id, credits.id));
    await unpauseCreditExhaustedProjects(userId);
    return { granted: 0, skipped: false };
  }

  const newBalance = credits.balance + refillAmount;
  await db.transaction(async (tx) => {
    await tx
      .update(schema.userCredits)
      .set({
        balance: newBalance,
        tier,
        monthlyAllowance: getTierBuildLimit(tier) ?? 0,
        lastRefillAt: now,
        updatedAt: now,
      })
      .where(eq(schema.userCredits.id, credits.id));
    await tx.insert(schema.creditTransactions).values({
      userId,
      amount: refillAmount,
      type: "subscription_grant",
      description: `Plan credits for ${tier} (${refillAmount} credits)`,
      stripePaymentIntentId: idempotencyKey ?? null,
    });
  });
  await unpauseCreditExhaustedProjects(userId);
  return { granted: refillAmount, skipped: false };
}

export async function updateProjectCreditsSpent(projectId: number, spent: number) {
  await db
    .update(schema.projects)
    .set({ creditsSpent: spent, updatedAt: new Date() })
    .where(eq(schema.projects.id, projectId));
}

export async function pauseProject(projectId: number, reason: string) {
  await db
    .update(schema.projects)
    .set({ status: "paused", pauseReason: reason, updatedAt: new Date() })
    .where(eq(schema.projects.id, projectId));
}

export async function resumeProject(projectId: number) {
  await db
    .update(schema.projects)
    .set({ status: "running", pauseReason: null, updatedAt: new Date() })
    .where(eq(schema.projects.id, projectId));
}

export async function getCreditTransactions(userId: number) {
  return db.query.creditTransactions.findMany({
    where: eq(schema.creditTransactions.userId, userId),
    orderBy: desc(schema.creditTransactions.createdAt),
  });
}
