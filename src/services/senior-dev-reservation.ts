import { and, eq, like, lt } from "drizzle-orm";
import { db } from "../db.js";
import * as schema from "../db/schema.js";

/**
 * Returns whether the original Senior Dev reservation actually consumed credits.
 * This intentionally derives refund eligibility from the immutable credit ledger
 * instead of the user's current plan/tier, which may have changed since start.
 */
export async function wasSeniorDevReservationCharged(
  userId: number,
  projectId: number,
  taskId: number,
): Promise<boolean> {
  const reservationPrefix = `Senior Dev Agent reservation senior-dev-${taskId}-%`;
  const rows = await db
    .select({ id: schema.creditTransactions.id })
    .from(schema.creditTransactions)
    .where(
      and(
        eq(schema.creditTransactions.userId, userId),
        eq(schema.creditTransactions.projectId, projectId),
        eq(schema.creditTransactions.type, "build_usage"),
        lt(schema.creditTransactions.amount, 0),
        like(schema.creditTransactions.description, reservationPrefix),
      ),
    )
    .limit(1);

  return rows.length > 0;
}
