import { and, asc, eq, gt, like, lt, or } from "drizzle-orm";
import { addCredits, db } from "../db.js";
import * as schema from "../db/schema.js";
import { SENIOR_DEV_CREDIT_COST } from "../lib/credits.js";

type LedgerEntry = {
  id: number;
  amount: number;
};

async function getSeniorDevReservationLedger(
  userId: number,
  projectId: number,
  taskId: number,
): Promise<LedgerEntry[]> {
  const reservationPattern = `Senior Dev Agent reservation senior-dev-${taskId}-%`;
  const ledgerRefundPattern = `senior-dev-ledger-refund-${taskId}-%`;
  const legacyInitialRefundPattern = `senior-dev-refund-senior-dev-${taskId}-%`;
  const legacyResumeRefundKey = `senior-dev-resume-refund-${taskId}`;

  return db
    .select({
      id: schema.creditTransactions.id,
      amount: schema.creditTransactions.amount,
    })
    .from(schema.creditTransactions)
    .where(
      and(
        eq(schema.creditTransactions.userId, userId),
        or(
          and(
            eq(schema.creditTransactions.projectId, projectId),
            eq(schema.creditTransactions.type, "build_usage"),
            lt(schema.creditTransactions.amount, 0),
            like(schema.creditTransactions.description, reservationPattern),
          ),
          and(
            eq(schema.creditTransactions.type, "senior_dev_refund"),
            gt(schema.creditTransactions.amount, 0),
            or(
              like(
                schema.creditTransactions.stripePaymentIntentId,
                ledgerRefundPattern,
              ),
              like(
                schema.creditTransactions.stripePaymentIntentId,
                legacyInitialRefundPattern,
              ),
              eq(
                schema.creditTransactions.stripePaymentIntentId,
                legacyResumeRefundKey,
              ),
            ),
          ),
        ),
      ),
    )
    .orderBy(asc(schema.creditTransactions.id));
}

/**
 * Returns the ledger id of the paid Senior Dev reservation that still needs a
 * refund. Charges and refunds are paired chronologically, so completed retries
 * cannot make an older refunded attempt look outstanding again.
 */
export async function getOutstandingSeniorDevReservationChargeId(
  userId: number,
  projectId: number,
  taskId: number,
): Promise<number | null> {
  const entries = await getSeniorDevReservationLedger(userId, projectId, taskId);
  const outstanding: number[] = [];

  for (const entry of entries) {
    if (entry.amount < 0) {
      outstanding.push(entry.id);
      continue;
    }
    if (entry.amount > 0 && outstanding.length > 0) {
      outstanding.shift();
    }
  }

  return outstanding[0] ?? null;
}

export async function wasSeniorDevReservationCharged(
  userId: number,
  projectId: number,
  taskId: number,
): Promise<boolean> {
  return (
    (await getOutstandingSeniorDevReservationChargeId(
      userId,
      projectId,
      taskId,
    )) !== null
  );
}

/**
 * Refunds exactly one outstanding paid reservation. The charge id is embedded
 * in the credit-ledger idempotency key, so duplicate or concurrent failure
 * handlers converge on the same refund transaction.
 */
export async function refundOutstandingSeniorDevReservation(
  userId: number,
  projectId: number,
  taskId: number,
  description: string,
): Promise<boolean> {
  const chargeId = await getOutstandingSeniorDevReservationChargeId(
    userId,
    projectId,
    taskId,
  );
  if (chargeId === null) return false;

  await addCredits(
    userId,
    SENIOR_DEV_CREDIT_COST,
    "senior_dev_refund",
    description,
    `senior-dev-ledger-refund-${taskId}-${chargeId}`,
  );
  return true;
}
