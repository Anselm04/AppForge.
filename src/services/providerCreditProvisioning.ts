import { INCLUDED_PROVIDER_CREDIT_CENTS } from "../lib/providerCreditPolicy.js";
import { db } from "../db.js";
import { sql } from "drizzle-orm";

const safeId = (value: number) => Number.isSafeInteger(value) && value > 0;

function invoicePeriod(
  startSeconds: number,
  endSeconds: number,
): { start: string; end: Date } {
  if (
    !Number.isSafeInteger(startSeconds) ||
    !Number.isSafeInteger(endSeconds) ||
    startSeconds <= 0 ||
    endSeconds <= startSeconds
  ) {
    throw new Error("Invalid Stripe invoice billing period");
  }
  const start = new Date(startSeconds * 1000);
  const end = new Date(endSeconds * 1000);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    throw new Error("Invalid Stripe invoice billing period");
  }
  return { start: start.toISOString().slice(0, 10), end };
}

/**
 * Provision the provider-cost allowance for one settled subscription invoice.
 * The Stripe invoice and its billing period are the idempotency boundary.
 */
export async function grantStripeInvoiceProviderCredits(
  userId: number,
  tier: string,
  invoiceId: string,
  periodStartSeconds: number,
  periodEndSeconds: number,
): Promise<{ grantedCents: number; skipped: boolean }> {
  if (!safeId(userId) || !/^in_[A-Za-z0-9]+$/.test(invoiceId)) {
    throw new Error("Valid customer and Stripe invoice are required");
  }
  const tierHasIncludedAllowance = Object.prototype.hasOwnProperty.call(
    INCLUDED_PROVIDER_CREDIT_CENTS,
    tier,
  );
  const negotiatedTierWithoutDefaultAllowance =
    tier === "enterprise" || tier === "custom";
  if (!tierHasIncludedAllowance && !negotiatedTierWithoutDefaultAllowance) {
    throw new Error(`No approved provider-credit policy for tier: ${tier}`);
  }
  const allowance = tierHasIncludedAllowance
    ? INCLUDED_PROVIDER_CREDIT_CENTS[
        tier as keyof typeof INCLUDED_PROVIDER_CREDIT_CENTS
      ]
    : 0;
  const period = invoicePeriod(periodStartSeconds, periodEndSeconds);

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${userId})`);
    await tx.execute(sql`
      INSERT INTO provider_credit_accounts (user_id, purchased_balance_cents)
      VALUES (${userId}, 0)
      ON CONFLICT (user_id) DO NOTHING
      RETURNING user_id
    `);

    const inserted = await tx.execute(sql`
      INSERT INTO provider_credit_periods
        (user_id, period_start, period_end, included_balance_cents,
         included_allowance_cents, grant_invoice_id)
      VALUES (${userId}, ${period.start}::date, ${period.end.toISOString()},
        ${allowance}, ${allowance}, ${invoiceId})
      ON CONFLICT (user_id, period_start) DO NOTHING
      RETURNING user_id
    `);
    if ((inserted as unknown as unknown[]).length === 0) {
      const existing = await tx.execute<{
        invoiceId: string | null;
        periodEnd: Date | string;
        allowance: string;
      }>(sql`
        SELECT grant_invoice_id AS "invoiceId",
          period_end AS "periodEnd",
          included_allowance_cents::text AS allowance
        FROM provider_credit_periods
        WHERE user_id = ${userId} AND period_start = ${period.start}::date
        FOR UPDATE
      `);
      const prior = (
        existing as unknown as Array<{
          invoiceId: string | null;
          periodEnd: Date | string;
          allowance: string;
        }>
      )[0];
      if (
        prior?.invoiceId === invoiceId &&
        new Date(prior.periodEnd).getTime() === period.end.getTime() &&
        Number(prior.allowance) === allowance
      ) {
        return { grantedCents: 0, skipped: true };
      }
      throw new Error(
        "Provider-credit billing period conflicts with an existing invoice grant",
      );
    }

    if (allowance > 0) {
      await tx.execute(sql`
        INSERT INTO provider_credit_events
          (user_id, source_id, kind, amount_cents, period_start)
        VALUES (${userId}, ${invoiceId}, 'included_grant', ${allowance},
          ${period.start}::date)
      `);
    }
    return { grantedCents: allowance, skipped: false };
  });
}
