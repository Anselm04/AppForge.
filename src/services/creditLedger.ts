import { and, desc, eq, sql } from "drizzle-orm";
import { db, getTierBuildLimit, getTierCreditRefill, unpauseCreditExhaustedProjects } from "../db.js";
import * as schema from "../db/schema.js";

async function ensureCreditsRow(userId: number) {
  await db
    .insert(schema.userCredits)
    .values({ userId, balance: 20, tier: "free", monthlyAllowance: 3 })
    .onConflictDoNothing({ target: schema.userCredits.userId });

  const row = await db.query.userCredits.findFirst({
    where: eq(schema.userCredits.userId, userId),
  });
  if (!row) throw new Error(`Failed to initialize credits for user ${userId}`);
  return row;
}

export async function deductCreditsSafe(
  userId: number,
  amount: number,
  projectId?: number,
  description?: string,
) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Credit deduction amount must be a positive integer");
  }
  await ensureCreditsRow(userId);

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${userId})`);
    const rows = await tx
      .select()
      .from(schema.userCredits)
      .where(eq(schema.userCredits.userId, userId))
      .limit(1);
    const credits = rows[0];
    if (!credits) throw new Error(`Insufficient credits: need ${amount}, have 0`);

    if (credits.unlimited) {
      await tx.insert(schema.creditTransactions).values({
        userId,
        amount: 0,
        type: "build_usage",
        projectId: projectId ?? null,
        description: `${description ?? "Build agent usage"} (unlimited)`,
      });
      return credits.balance;
    }
    if (credits.balance < amount) {
      throw new Error(`Insufficient credits: need ${amount}, have ${credits.balance}`);
    }

    const newBalance = credits.balance - amount;
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
    return newBalance;
  });
}

export async function addCreditsSafe(
  userId: number,
  amount: number,
  type: string,
  description?: string,
  stripePaymentIntentId?: string,
) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Credit grant amount must be a positive integer");
  }
  await ensureCreditsRow(userId);

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${userId})`);

    if (stripePaymentIntentId) {
      const prior = await tx
        .select({ id: schema.creditTransactions.id })
        .from(schema.creditTransactions)
        .where(eq(schema.creditTransactions.stripePaymentIntentId, stripePaymentIntentId))
        .limit(1);
      if (prior[0]) {
        const current = await tx
          .select({ balance: schema.userCredits.balance })
          .from(schema.userCredits)
          .where(eq(schema.userCredits.userId, userId))
          .limit(1);
        return { balance: current[0]?.balance ?? 0, skipped: true };
      }
    }

    const current = await tx
      .select()
      .from(schema.userCredits)
      .where(eq(schema.userCredits.userId, userId))
      .limit(1);
    const credits = current[0];
    if (!credits) throw new Error(`Credits row missing for user ${userId}`);
    const newBalance = credits.balance + amount;

    await tx
      .update(schema.userCredits)
      .set({ balance: newBalance, updatedAt: new Date() })
      .where(eq(schema.userCredits.id, credits.id));
    await tx.insert(schema.creditTransactions).values({
      userId,
      amount,
      type,
      description: description ?? "Credit purchase",
      stripePaymentIntentId: stripePaymentIntentId ?? null,
    });
    return { balance: newBalance, skipped: false };
  });

  if (!result.skipped) await unpauseCreditExhaustedProjects(userId);
  return result.balance;
}

export async function grantPlanCreditsSafe(
  userId: number,
  tier: string,
  idempotencyKey?: string,
): Promise<{ granted: number; skipped: boolean }> {
  await ensureCreditsRow(userId);
  const refillAmount = getTierCreditRefill(tier);
  const now = new Date();

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${userId})`);

    if (idempotencyKey) {
      const prior = await tx
        .select({ id: schema.creditTransactions.id })
        .from(schema.creditTransactions)
        .where(eq(schema.creditTransactions.stripePaymentIntentId, idempotencyKey))
        .limit(1);
      if (prior[0]) return { granted: 0, skipped: true };
    }

    const creditRows = await tx
      .select()
      .from(schema.userCredits)
      .where(eq(schema.userCredits.userId, userId))
      .limit(1);
    const credits = creditRows[0];
    if (!credits) return { granted: 0, skipped: true };

    const grants = await tx
      .select({ createdAt: schema.creditTransactions.createdAt })
      .from(schema.creditTransactions)
      .where(
        and(
          eq(schema.creditTransactions.userId, userId),
          eq(schema.creditTransactions.type, "subscription_grant"),
        ),
      )
      .orderBy(desc(schema.creditTransactions.createdAt))
      .limit(1);

    if (grants[0]?.createdAt && refillAmount !== null) {
      const daysSinceGrant =
        (now.getTime() - new Date(grants[0].createdAt).getTime()) / 86400000;
      const samePaidTier = (credits.tier ?? "free") === tier && tier !== "free";
      if (samePaidTier && daysSinceGrant < 25) {
        return { granted: 0, skipped: true };
      }
    }

    if (refillAmount === null) {
      await tx
        .update(schema.userCredits)
        .set({
          tier,
          monthlyAllowance: getTierBuildLimit(tier) ?? 0,
          lastRefillAt: now,
          updatedAt: now,
        })
        .where(eq(schema.userCredits.id, credits.id));
      return { granted: 0, skipped: false };
    }

    const newBalance = credits.balance + refillAmount;
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
    return { granted: refillAmount, skipped: false };
  });

  await unpauseCreditExhaustedProjects(userId);
  return result;
}
