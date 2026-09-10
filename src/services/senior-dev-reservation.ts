import { and, eq, gt, like, lt, or } from "drizzle-orm";
import { db } from "../db.js";
import * as schema from "../db/schema.js";

/**
 * Returns whether a Senior Dev task still has an outstanding paid reservation.
 * Refund eligibility is derived from the immutable credit ledger instead of the
 * user's current plan/tier. Summing matching charges and refunds also prevents
 * an older refunded retry from being mistaken for a currently charged attempt.
 */
export async function wasSeniorDevReservationCharged(
  userId: number,
  projectId: number,
  taskId: number,
): Promise<boolean> {
  const reservationPattern = `Senior Dev Agent reservation senior-dev-${taskId}-%`;
  const refundPattern = `%task ${taskId}%`;

  const rows = await db
    .select({ amount: schema.creditTransactions.amount })
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
            like(schema.creditTransactions.description, refundPattern),
          ),
        ),
      ),
    );

  const netAmount = rows.reduce((sum, row) => sum + row.amount, 0);
  return netAmount < 0;
}
