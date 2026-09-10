import { and, eq } from "drizzle-orm";
import { db } from "../db.js";
import * as schema from "../db/schema.js";

/**
 * Atomically claims an awaiting Senior Dev task for execution.
 * Exactly one concurrent resume request can transition the task to executing.
 */
export async function claimSeniorDevResume(
  taskId: number,
  userId: number,
): Promise<boolean> {
  const claimed = await db
    .update(schema.seniorDevTasks)
    .set({
      status: "executing",
      planApproved: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.seniorDevTasks.id, taskId),
        eq(schema.seniorDevTasks.userId, userId),
        eq(schema.seniorDevTasks.status, "awaiting_approval"),
      ),
    )
    .returning({ id: schema.seniorDevTasks.id });

  return claimed.length === 1;
}
