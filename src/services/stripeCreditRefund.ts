import { and, eq, sql } from "drizzle-orm";
import { db, ensureUserCredits } from "../db.js";
import * as schema from "../db/schema.js";

type RefundState = {
  accountedCredits: number;
  amountRefunded: number;
};

function parseRefundState(value: string | undefined): RefundState {
  if (!value) return { accountedCredits: 0, amountRefunded: 0 };
  const parsed = JSON.parse(value) as Partial<RefundState>;
  if (
    !Number.isSafeInteger(parsed.accountedCredits) ||
    !Number.isSafeInteger(parsed.amountRefunded) ||
    (parsed.accountedCredits ?? -1) < 0 ||
    (parsed.amountRefunded ?? -1) < 0
  ) {
    throw new Error("Invalid persisted Stripe refund reconciliation state");
  }
  return {
    accountedCredits: parsed.accountedCredits!,
    amountRefunded: parsed.amountRefunded!,
  };
}

/**
 * Reconcile the cumulative refunded amount for a one-time Stripe credit pack.
 * Stripe Charge.amount_refunded is cumulative, so the target number of credits
 * to revoke is deterministic across any sequence of partial/full refunds.
 *
 * Partial refunds round down to whole credits; a full refund always targets the
 * entire original pack. Credits already consumed are recorded as unrecovered
 * rather than driving the user's balance negative.
 */
export async function reconcileCreditPurchaseRefund(
  paymentIntentId: string,
  refundEventId: string,
  chargeAmount: number,
  amountRefunded: number,
  fullyRefunded: boolean,
): Promise<{
  targetCredits: number;
  revoked: number;
  unrecovered: number;
  skipped: boolean;
}> {
  if (!paymentIntentId.startsWith("pi_")) {
    throw new Error("A valid Stripe PaymentIntent ID is required for refund");
  }
  if (!refundEventId.startsWith("evt_")) {
    throw new Error(
      "A valid Stripe event ID is required for refund idempotency",
    );
  }
  if (
    !Number.isSafeInteger(chargeAmount) ||
    chargeAmount <= 0 ||
    !Number.isSafeInteger(amountRefunded) ||
    amountRefunded < 0 ||
    amountRefunded > chargeAmount
  ) {
    throw new Error("Invalid Stripe refund amounts");
  }

  const original = await db.query.creditTransactions.findFirst({
    where: and(
      eq(schema.creditTransactions.stripePaymentIntentId, paymentIntentId),
      eq(schema.creditTransactions.type, "purchase"),
    ),
  });
  if (!original || original.amount <= 0 || !original.userId) {
    return {
      targetCredits: 0,
      revoked: 0,
      unrecovered: 0,
      skipped: true,
    };
  }

  const userId = original.userId;
  await ensureUserCredits(userId);
  const stateKey = `stripe_refund:${paymentIntentId}`;

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${userId})`);

    const priorEvent = await tx
      .select({ id: schema.creditTransactions.id })
      .from(schema.creditTransactions)
      .where(eq(schema.creditTransactions.stripePaymentIntentId, refundEventId))
      .limit(1);
    if (priorEvent[0]) {
      return {
        targetCredits: 0,
        revoked: 0,
        unrecovered: 0,
        skipped: true,
      };
    }

    const stateRows = await tx
      .select({ value: schema.appSettings.value })
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, stateKey))
      .limit(1);
    const prior = parseRefundState(stateRows[0]?.value);

    if (amountRefunded < prior.amountRefunded) {
      throw new Error("Stripe cumulative refund amount moved backwards");
    }

    const targetCredits = fullyRefunded
      ? original.amount
      : Math.floor((original.amount * amountRefunded) / chargeAmount);
    const cappedTarget = Math.min(original.amount, targetCredits);
    const delta = Math.max(0, cappedTarget - prior.accountedCredits);

    if (delta === 0) {
      await tx
        .insert(schema.appSettings)
        .values({
          key: stateKey,
          value: JSON.stringify({
            accountedCredits: prior.accountedCredits,
            amountRefunded,
          }),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.appSettings.key,
          set: {
            value: JSON.stringify({
              accountedCredits: prior.accountedCredits,
              amountRefunded,
            }),
            updatedAt: new Date(),
          },
        });
      return {
        targetCredits: cappedTarget,
        revoked: 0,
        unrecovered: 0,
        skipped: true,
      };
    }

    const rows = await tx
      .select()
      .from(schema.userCredits)
      .where(eq(schema.userCredits.userId, userId))
      .limit(1);
    const credits = rows[0];
    if (!credits) {
      throw new Error(`Credits row missing for user ${userId}`);
    }

    const revoked = Math.min(credits.balance, delta);
    const unrecovered = delta - revoked;

    await tx
      .update(schema.userCredits)
      .set({ balance: credits.balance - revoked, updatedAt: new Date() })
      .where(eq(schema.userCredits.id, credits.id));

    await tx.insert(schema.creditTransactions).values({
      userId,
      amount: -revoked,
      type: "purchase_refund",
      description:
        unrecovered > 0
          ? `Stripe credit refund reconciled; ${unrecovered} consumed credits could not be revoked`
          : "Stripe credit refund reconciled",
      stripePaymentIntentId: refundEventId,
    });

    await tx
      .insert(schema.appSettings)
      .values({
        key: stateKey,
        value: JSON.stringify({
          accountedCredits: cappedTarget,
          amountRefunded,
        }),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.appSettings.key,
        set: {
          value: JSON.stringify({
            accountedCredits: cappedTarget,
            amountRefunded,
          }),
          updatedAt: new Date(),
        },
      });

    return {
      targetCredits: cappedTarget,
      revoked,
      unrecovered,
      skipped: false,
    };
  });
}
