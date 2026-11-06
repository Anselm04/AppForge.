import { PROVISIONAL_PROVIDER_MONTHLY_CEILINGS_CENTS } from "../lib/providerCostPolicy.js";
import { sql } from "drizzle-orm";
import { db } from "../db.js";

/** Preparatory money ledger: NOT a production release or permission to bill. */
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
export async function reserveProviderSpend(input: ProviderReservationInput): Promise<"reserved" | "duplicate"> {
  if (!safeId(input.userId) || !safeId(input.projectId) || !safeId(input.executionId) ||
    !validKey(input.operationId) || !safeCents(input.maximumCents) || input.maximumCents === 0
    ) throw new Error("Invalid provider reservation");
  return db.transaction(async (tx) => {
    const owner = await tx.execute(sql`SELECT id FROM users WHERE id = ${input.userId} FOR UPDATE`);
    if ((owner as unknown as unknown[]).length !== 1) throw new Error("Customer not found");
    const project = await tx.execute(sql`SELECT id FROM projects WHERE id = ${input.projectId} AND user_id = ${input.userId}`);
    if ((project as unknown as unknown[]).length !== 1) throw new Error("Project ownership mismatch");
    // A caller cannot choose its own monetary allowance. Resolve current
    // paid subscription status under the same serialized user transaction.
    const subscriptions = await tx.execute<{
      tier: string; status: string; periodEnd: Date | string | null;
      trialEnd: Date | string | null;
    }>(sql`
      SELECT tier, status, current_period_end AS "periodEnd", trial_end AS "trialEnd"
      FROM subscriptions WHERE user_id = ${input.userId}
    `);
    const sub = (subscriptions as unknown as Array<{
      tier: string; status: string; periodEnd: Date | string | null;
      trialEnd: Date | string | null;
    }>)[0];
    const now = new Date();
    const active = sub?.status === "active" || sub?.status === "trialing";
    const validEnd = (value: Date | string | null | undefined) =>
      !value || (Number.isFinite(new Date(value).getTime()) &&
        new Date(value).getTime() > now.getTime());
    const validPeriod = validEnd(sub?.periodEnd);
    const validTrial = sub?.status !== "trialing" || validEnd(sub?.trialEnd);
    if (!active || !validPeriod || !validTrial ||
        !sub || !Object.prototype.hasOwnProperty.call(
          PROVISIONAL_PROVIDER_MONTHLY_CEILINGS_CENTS, sub.tier)) {
      throw new Error("Active approved-tier subscription required for provider reservation");
    }
    const monthlyLimitCents = PROVISIONAL_PROVIDER_MONTHLY_CEILINGS_CENTS[
      sub.tier as keyof typeof PROVISIONAL_PROVIDER_MONTHLY_CEILINGS_CENTS
    ];
    if (monthlyLimitCents <= 0) throw new Error("No provider budget for this tier");

    const existing = await tx.execute<Reservation>(sql`
      SELECT state, maximum_cents::text AS "maximumCents", actual_cents::text AS "actualCents",
        project_id AS "projectId", execution_id AS "executionId"
      FROM provider_spend_reservations WHERE user_id = ${input.userId} AND operation_id = ${input.operationId}
    `);
    const previous = (existing as unknown as Reservation[])[0];
    if (previous) {
      if (previous.state === "released" || previous.projectId !== input.projectId ||
        previous.executionId !== input.executionId || amount(previous.maximumCents) !== input.maximumCents)
        throw new Error("Conflicting or released provider operation");
      return "duplicate";
    }
    const date = new Date();
    date.setUTCDate(1);
    date.setUTCHours(0, 0, 0, 0);
    const period = date.toISOString().slice(0, 10);
    const usage = await tx.execute<{ total: string }>(sql`
      SELECT COALESCE(SUM(COALESCE(actual_cents, maximum_cents)), 0)::text AS total
      FROM provider_spend_reservations WHERE user_id = ${input.userId}
        AND period_start = ${period}::date AND state IN ('reserved', 'settled')
    `);
    const spent = amount((usage as unknown as Array<{ total: string }>)[0]?.total ?? "0");
    if (input.maximumCents > monthlyLimitCents - spent)
      throw new Error("Provider budget exhausted; pause and quote");
    await tx.execute(sql`
      INSERT INTO provider_spend_reservations
        (operation_id, user_id, project_id, execution_id, period_start, maximum_cents, state)
      VALUES (${input.operationId}, ${input.userId}, ${input.projectId},
        ${input.executionId}, ${period}::date, ${input.maximumCents}, 'reserved')
    `);
    return "reserved";
  });
}

/** Unknown charges remain reserved. A timeout never proves a call was free. */
export async function settleProviderSpend(userId: number, operationId: string, verifiedCents: number): Promise<void> {
  if (!safeId(userId) || !validKey(operationId) || !safeCents(verifiedCents))
    throw new Error("Invalid provider settlement");
  await db.transaction(async (tx) => {
    const owner = await tx.execute(sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`);
    if ((owner as unknown as unknown[]).length !== 1) throw new Error("Customer not found");
    const data = await tx.execute<Reservation>(sql`
      SELECT state, maximum_cents::text AS "maximumCents", actual_cents::text AS "actualCents"
      FROM provider_spend_reservations WHERE user_id = ${userId} AND operation_id = ${operationId} FOR UPDATE
    `);
    const item = (data as unknown as Reservation[])[0];
    if (!item || item.state === "released") throw new Error("Missing active reservation");
    if (verifiedCents > amount(item.maximumCents))
      throw new Error("Charge exceeds reservation; freeze further work");
    if (item.state === "settled") {
      if (item.actualCents === null || amount(item.actualCents) !== verifiedCents)
        throw new Error("Conflicting settlement");
      return;
    }
    await tx.execute(sql`
      UPDATE provider_spend_reservations SET state = 'settled', actual_cents = ${verifiedCents},
        updated_at = NOW() WHERE user_id = ${userId} AND operation_id = ${operationId}
    `);
  });
}
