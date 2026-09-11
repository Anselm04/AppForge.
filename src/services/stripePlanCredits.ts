import { and, eq, sql } from "drizzle-orm";
import {
  db,
  ensureUserCredits,
  getTierBuildLimit,
  getTierCreditRefill,
  unpauseCreditExhaustedProjects,
} from "../db.js";
import * as schema from "../db/schema.js";

/**
 * Grant the credits purchased by one settled Stripe subscription invoice.
 *
 * Stripe invoice IDs are the idempotency boundary: every distinct paid invoice
 * can grant exactly once, while webhook retries/replays of the same invoice are
 * harmless. We deliberately do not use a time-window heuristic because a real
 * re-subscription can legitimately produce another paid invoice within days.
 */
export async function grantStripeInvoicePlanCredits(
  userId: number,
  tier: string,
  invoiceId: string,
): Promise<{ granted: number; skipped: boolean }> {
  if (!invoiceId || !invoiceId.startsWith("in_")) {
    throw new Error("A valid Stripe invoice ID is required for plan credits");
  }

  await ensureUserCredits(userId);
  const refillAmount = getTierCreditRefill(tier);
  const now = new Date();

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${userId})`);

    const prior = await tx
      .select({ id: schema.creditTransactions.id })
      .from(schema.creditTransactions)
      .where(
        and(
          eq(schema.creditTransactions.userId, userId),
          eq(schema.creditTransactions.stripePaymentIntentId, invoiceId),
        ),
      )
      .limit(1);
    if (prior[0]) return { granted: 0, skipped: true };

    const creditRows = await tx
      .select()
      .from(schema.userCredits)
      .where(eq(schema.userCredits.userId, userId))
      .limit(1);
    const credits = creditRows[0];
    if (!credits) throw new Error(`Credits row missing for user ${userId}`);

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

      await tx.insert(schema.creditTransactions).values({
        userId,
        amount: 0,
        type: "subscription_grant",
        description: `Stripe plan entitlement for ${tier}`,
        stripePaymentIntentId: invoiceId,
      });
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
      description: `Stripe plan credits for ${tier} (${refillAmount} credits)`,
      stripePaymentIntentId: invoiceId,
    });

    return { granted: refillAmount, skipped: false };
  });

  if (!result.skipped) await unpauseCreditExhaustedProjects(userId);
  return result;
}
