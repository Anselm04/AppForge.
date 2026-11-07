import {
  INCLUDED_PROVIDER_CREDIT_CENTS,
  type ProviderCreditTier,
} from "../lib/providerCreditPolicy.js";
import { sql } from "drizzle-orm";
import { db } from "../db.js";

/** Atomic provider-credit authority; not a production release permission. */
export type ProviderReservationInput = {
  userId: number;
  projectId: number;
  executionId: number;
  operationId: string;
  maximumCents: number;
};
type Reservation = {
  state: "reserved" | "settled" | "released";
  maximumCents: string;
  actualCents: string | null;
  overrun: boolean;
  periodStart: string | Date;
  includedReservedCents: string;
  purchasedReservedCents: string;
  projectId: number;
  executionId: number;
};
const safeCents = (v: number) => Number.isSafeInteger(v) && v >= 0;
const safeId = (v: number) => Number.isSafeInteger(v) && v > 0;
const validKey = (v: string) => /^[a-zA-Z0-9:_-]{8,128}$/.test(v);
const amount = (v: string | number): number => {
  const n = Number(v);
  if (!safeCents(n)) throw new Error("Unsafe provider ledger amount");
  return n;
};

/** A row lock serializes every spending reservation belonging to the user. */
export async function reserveProviderSpend(
  input: ProviderReservationInput,
): Promise<"reserved" | "duplicate"> {
  if (
    !safeId(input.userId) ||
    !safeId(input.projectId) ||
    !safeId(input.executionId) ||
    !validKey(input.operationId) ||
    !safeCents(input.maximumCents) ||
    input.maximumCents === 0
  )
    throw new Error("Invalid provider reservation");
  return db.transaction(async (tx) => {
    const owner = await tx.execute(
      sql`SELECT id FROM users WHERE id = ${input.userId} FOR UPDATE`,
    );
    if ((owner as unknown as unknown[]).length !== 1)
      throw new Error("Customer not found");
    const project = await tx.execute(
      sql`SELECT id FROM projects WHERE id = ${input.projectId} AND user_id = ${input.userId}`,
    );
    if ((project as unknown as unknown[]).length !== 1)
      throw new Error("Project ownership mismatch");
    const execution = await tx.execute(
      sql`SELECT id FROM build_events WHERE id = ${input.executionId} AND project_id = ${input.projectId} AND event = 'build_execution_claim'`,
    );
    if ((execution as unknown as unknown[]).length !== 1)
      throw new Error("Build execution ownership mismatch");
    // A caller cannot choose its own monetary allowance. Resolve current
    // paid subscription status under the same serialized user transaction.
    const subscriptions = await tx.execute<{
      tier: string;
      status: string;
      periodStart: Date | string | null;
      periodEnd: Date | string | null;
      trialEnd: Date | string | null;
    }>(sql`
      SELECT tier, status, current_period_start AS "periodStart",
        current_period_end AS "periodEnd", trial_end AS "trialEnd"
      FROM subscriptions WHERE user_id = ${input.userId} FOR UPDATE
    `);
    const sub = (
      subscriptions as unknown as Array<{
        tier: string;
        status: string;
        periodStart: Date | string | null;
        periodEnd: Date | string | null;
        trialEnd: Date | string | null;
      }>
    )[0];
    const now = new Date();
    const active = sub?.status === "active" || sub?.status === "trialing";
    const validTime = (value: Date | string | null | undefined) => {
      if (!value) return null;
      const time = new Date(value).getTime();
      return Number.isFinite(time) ? time : null;
    };
    const periodStart = validTime(sub?.periodStart);
    const periodEnd = validTime(sub?.periodEnd);
    const validPeriod =
      periodStart !== null &&
      periodEnd !== null &&
      periodStart < now.getTime() &&
      periodStart < periodEnd &&
      periodEnd > now.getTime();
    const trialEnd = validTime(sub?.trialEnd);
    const validTrial =
      sub?.status !== "trialing" ||
      (trialEnd !== null && trialEnd > now.getTime());
    if (
      !active ||
      !validPeriod ||
      !validTrial ||
      !sub ||
      periodStart === null ||
      !Object.prototype.hasOwnProperty.call(
        INCLUDED_PROVIDER_CREDIT_CENTS,
        sub.tier,
      )
    ) {
      throw new Error(
        "Active approved-tier subscription required for provider reservation",
      );
    }
    const approvedIncludedCents =
      INCLUDED_PROVIDER_CREDIT_CENTS[sub.tier as ProviderCreditTier];
    if (approvedIncludedCents <= 0)
      throw new Error("No approved provider credits for this tier");

    const existing = await tx.execute<Reservation>(sql`
      SELECT state, maximum_cents::text AS "maximumCents",
        actual_cents::text AS "actualCents", overrun,
        period_start::text AS "periodStart",
        included_reserved_cents::text AS "includedReservedCents",
        purchased_reserved_cents::text AS "purchasedReservedCents",
        project_id AS "projectId", execution_id AS "executionId"
      FROM provider_spend_reservations WHERE user_id = ${input.userId} AND operation_id = ${input.operationId}
    `);
    const previous = (existing as unknown as Reservation[])[0];
    if (previous) {
      if (
        previous.state === "released" ||
        previous.projectId !== input.projectId ||
        previous.executionId !== input.executionId ||
        amount(previous.maximumCents) !== input.maximumCents
      )
        throw new Error("Conflicting or released provider operation");
      return "duplicate";
    }
    const unresolvedOverrun = await tx.execute(sql`
      SELECT id FROM provider_spend_reservations
      WHERE user_id = ${input.userId} AND overrun = TRUE
      LIMIT 1
    `);
    if ((unresolvedOverrun as unknown as unknown[]).length > 0)
      throw new Error(
        "Provider spending is frozen pending overrun reconciliation",
      );
    const period = new Date(periodStart).toISOString().slice(0, 10);
    const credits = await tx.execute<{
      purchasedBalance: string;
    }>(sql`
      SELECT purchased_balance_cents::text AS "purchasedBalance"
      FROM provider_credit_accounts WHERE user_id = ${input.userId} FOR UPDATE
    `);
    const creditAccount = (
      credits as unknown as Array<{
        purchasedBalance: string;
      }>
    )[0];
    if (!creditAccount)
      throw new Error("Provider credit account is not provisioned");
    const periods = await tx.execute<{
      includedBalance: string;
      includedAllowance: string;
      periodEnd: Date | string;
    }>(sql`
      SELECT included_balance_cents::text AS "includedBalance",
        included_allowance_cents::text AS "includedAllowance",
        period_end AS "periodEnd"
      FROM provider_credit_periods
      WHERE user_id = ${input.userId} AND period_start = ${period}::date
      FOR UPDATE
    `);
    const creditPeriod = (
      periods as unknown as Array<{
        includedBalance: string;
        includedAllowance: string;
        periodEnd: Date | string;
      }>
    )[0];
    if (!creditPeriod)
      throw new Error("Provider credits are not provisioned for this period");
    if (amount(creditPeriod.includedAllowance) !== approvedIncludedCents)
      throw new Error("Provider credits do not match the active approved plan");
    const purchasedBalance = amount(creditAccount.purchasedBalance);
    const creditPeriodEnd = new Date(creditPeriod.periodEnd).getTime();
    if (!Number.isFinite(creditPeriodEnd) || creditPeriodEnd <= now.getTime())
      throw new Error("Provider credit period is expired");
    const pending = await tx.execute<{
      included: string;
      purchased: string;
    }>(sql`
      SELECT COALESCE(SUM(included_reserved_cents)
          FILTER (WHERE period_start = ${period}::date), 0)::text AS included,
        COALESCE(SUM(purchased_reserved_cents), 0)::text AS purchased
      FROM provider_spend_reservations
      WHERE user_id = ${input.userId} AND state = 'reserved'
    `);
    const pendingAmounts = (
      pending as unknown as Array<{
        included: string;
        purchased: string;
      }>
    )[0];
    const includedHeld = amount(pendingAmounts?.included ?? "0");
    const purchasedHeld = amount(pendingAmounts?.purchased ?? "0");
    const includedAvailable =
      amount(creditPeriod.includedBalance) - includedHeld;
    const purchasedAvailable = purchasedBalance - purchasedHeld;
    const availableCents = includedAvailable + purchasedAvailable;
    if (
      !Number.isSafeInteger(availableCents) ||
      input.maximumCents > availableCents
    )
      throw new Error(
        "Included and purchased provider credits exhausted; pause and quote",
      );
    const buildUsage = await tx.execute<{ total: string }>(sql`
      SELECT COALESCE(SUM(COALESCE(actual_cents, maximum_cents)), 0)::text AS total
      FROM provider_spend_reservations WHERE user_id = ${input.userId}
        AND execution_id = ${input.executionId}
        AND (
          state = 'reserved'
          OR (period_start = ${period}::date AND state = 'settled')
        )
    `);
    const buildSpent = amount(
      (buildUsage as unknown as Array<{ total: string }>)[0]?.total ?? "0",
    );
    const buildLimitCents = Math.floor(
      (approvedIncludedCents + purchasedBalance) / 4,
    );
    if (input.maximumCents > buildLimitCents - buildSpent)
      throw new Error("Provider per-build budget exhausted; pause and quote");
    const includedReservedCents = Math.min(
      input.maximumCents,
      includedAvailable,
    );
    const purchasedReservedCents = input.maximumCents - includedReservedCents;
    await tx.execute(sql`
      INSERT INTO provider_spend_reservations
        (operation_id, user_id, project_id, execution_id, period_start,
          maximum_cents, included_reserved_cents, purchased_reserved_cents, state)
      VALUES (${input.operationId}, ${input.userId}, ${input.projectId},
        ${input.executionId}, ${period}::date, ${input.maximumCents},
        ${includedReservedCents}, ${purchasedReservedCents}, 'reserved')
    `);
    return "reserved";
  });
}

/** Unknown charges remain reserved. A timeout never proves a call was free. */
export async function settleProviderSpend(
  userId: number,
  operationId: string,
  verifiedCents: number,
): Promise<void> {
  if (!safeId(userId) || !validKey(operationId) || !safeCents(verifiedCents))
    throw new Error("Invalid provider settlement");
  const overrun = await db.transaction(async (tx) => {
    const owner = await tx.execute(
      sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`,
    );
    if ((owner as unknown as unknown[]).length !== 1)
      throw new Error("Customer not found");
    const data = await tx.execute<Reservation>(sql`
      SELECT state, maximum_cents::text AS "maximumCents",
        actual_cents::text AS "actualCents", overrun,
        period_start::text AS "periodStart",
        included_reserved_cents::text AS "includedReservedCents",
        purchased_reserved_cents::text AS "purchasedReservedCents"
      FROM provider_spend_reservations WHERE user_id = ${userId} AND operation_id = ${operationId} FOR UPDATE
    `);
    const item = (data as unknown as Reservation[])[0];
    if (!item || item.state === "released")
      throw new Error("Missing active reservation");
    if (item.state === "settled") {
      if (
        item.actualCents === null ||
        amount(item.actualCents) !== verifiedCents
      )
        throw new Error("Conflicting settlement");
      return item.overrun;
    }
    const accounts = await tx.execute<{ purchasedBalance: string }>(sql`
      SELECT purchased_balance_cents::text AS "purchasedBalance"
      FROM provider_credit_accounts WHERE user_id = ${userId} FOR UPDATE
    `);
    const account = (
      accounts as unknown as Array<{
        purchasedBalance: string;
      }>
    )[0];
    if (!account)
      throw new Error(
        "Provider credit account is missing; charge remains unresolved",
      );
    const periods = await tx.execute<{ periodEnd: Date | string }>(sql`
      SELECT period_end AS "periodEnd" FROM provider_credit_periods
      WHERE user_id = ${userId} AND period_start = ${item.periodStart}::date
      FOR UPDATE
    `);
    if ((periods as unknown as unknown[]).length !== 1)
      throw new Error(
        "Provider credit period is missing; charge remains unresolved",
      );
    const includedReserved = amount(item.includedReservedCents);
    const purchasedReserved = amount(item.purchasedReservedCents);
    if (includedReserved + purchasedReserved !== amount(item.maximumCents))
      throw new Error("Provider reservation credit allocation is inconsistent");
    const billableAgainstReservation = Math.min(
      verifiedCents,
      amount(item.maximumCents),
    );
    const includedDebited = Math.min(
      billableAgainstReservation,
      includedReserved,
    );
    const purchasedDebited = Math.min(
      billableAgainstReservation - includedDebited,
      purchasedReserved,
    );
    const underfunded =
      billableAgainstReservation - includedDebited - purchasedDebited > 0;
    const exceeded = verifiedCents > amount(item.maximumCents) || underfunded;
    await tx.execute(sql`
      UPDATE provider_credit_periods SET
        included_balance_cents = included_balance_cents - ${includedDebited},
        updated_at = NOW()
      WHERE user_id = ${userId} AND period_start = ${item.periodStart}::date
    `);
    await tx.execute(sql`
      UPDATE provider_credit_accounts SET
        purchased_balance_cents = purchased_balance_cents - ${purchasedDebited},
        updated_at = NOW()
      WHERE user_id = ${userId}
    `);
    await tx.execute(sql`
      UPDATE provider_spend_reservations SET state = 'settled',
        actual_cents = ${verifiedCents}, overrun = ${exceeded},
        updated_at = NOW()
      WHERE user_id = ${userId} AND operation_id = ${operationId}
    `);
    return exceeded;
  });
  if (overrun) {
    throw new Error(
      "Provider charge exceeded its reservation; spending is frozen pending reconciliation",
    );
  }
}

/** Release only when the caller can prove dispatch never started. */
export async function releaseProviderSpend(
  userId: number,
  operationId: string,
): Promise<void> {
  if (!safeId(userId) || !validKey(operationId))
    throw new Error("Invalid provider reservation release");
  await db.transaction(async (tx) => {
    const owner = await tx.execute(
      sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`,
    );
    if ((owner as unknown as unknown[]).length !== 1)
      throw new Error("Customer not found");
    const rows = await tx.execute<{ state: string }>(sql`
      SELECT state FROM provider_spend_reservations
      WHERE user_id = ${userId} AND operation_id = ${operationId}
      FOR UPDATE
    `);
    const reservation = (rows as unknown as Array<{ state: string }>)[0];
    if (!reservation) throw new Error("Missing provider reservation");
    if (reservation.state === "released") return;
    if (reservation.state !== "reserved")
      throw new Error(
        "Only an undispatched provider reservation can be released",
      );
    await tx.execute(sql`
      UPDATE provider_spend_reservations SET state = 'released',
        updated_at = NOW()
      WHERE user_id = ${userId} AND operation_id = ${operationId}
    `);
  });
}
