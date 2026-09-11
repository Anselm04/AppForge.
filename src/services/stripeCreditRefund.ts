import { and, eq, sql } from "drizzle-orm";
import { db, ensureUserCredits } from "../db.js";
import * as schema from "../db/schema.js";

/**
 * Revoke unused credits when a one-time Stripe credit-pack payment is fully
 * refunded. The Stripe webhook event ID is the idempotency key, so retries are
 * harmless. Credits already consumed are reported as unrecovered rather than
 * driving the user's balance negative.
 */
export async function revokeFullyRefundedCreditPurchase(
  paymentIntentId: string,
  refundEventId: string,
): Promise<{
  revoked: number;
  unrecovered: number;
  skipped: boolean;
}> {
  if (!paymentIntentId.startsWith("pi_")) {
    throw new Error("A valid Stripe PaymentIntent ID is required for refund");
  }
  if (!refundEventId.startsWith("evt_")) {
    throw new Error("A valid Stripe event ID is required for refund idempotency");
  }

  const original = await db.query.creditTransactions.findFirst({
    where: and(
      eq(schema.creditTransactions.stripePaymentIntentId, paymentIntentId),
      eq(schema.creditTransactions.type, "purchase"),
    ),
  });
  if (!original || original.amount <= 0) {
    return { revoked: 0, unrecovered: 0, skipped: true };
  }

  await ensureUserCredits(original.userId!);

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${original.userId!})`);

    const prior = await tx
      .select({ id: schema.creditTransactions.id })
      .from(schema.creditTransactions)
      .where(eq(schema.creditTransactions.stripePaymentIntentId, refundEventId))
      .limit(1);
    if (prior[0]) {
      return { revoked: 0, unrecovered: 0, skipped: true };
    }

    const rows = await tx
      .select()
      .from(schema.userCredits)
      .where(eq(schema.userCredits.userId, original.userId!))
      .limit(1);
    const credits = rows[0];
    if (!credits) {
      throw new Error(`Credits row missing for user ${original.userId}`);
    }

    const revoked = Math.min(credits.balance, original.amount);
    const unrecovered = original.amount - revoked;

    await tx
      .update(schema.userCredits)
      .set({ balance: credits.balance - revoked, updatedAt: new Date() })
      .where(eq(schema.userCredits.id, credits.id));

    await tx.insert(schema.creditTransactions).values({
      userId: original.userId!,
      amount: -revoked,
      type: "purchase_refund",
      description:
        unrecovered > 0
          ? `Stripe credit purchase fully refunded; ${unrecovered} consumed credits could not be revoked`
          : "Stripe credit purchase fully refunded",
      stripePaymentIntentId: refundEventId,
    });

    return { revoked, unrecovered, skipped: false };
  });
}
