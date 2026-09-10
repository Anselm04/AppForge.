import { and, eq } from "drizzle-orm";
import { db } from "../db.js";
import * as schema from "../db/schema.js";

/**
 * Atomically claims a newly-created Senior Dev task for its first execution.
 * Exactly one concurrent starter can transition planning -> executing.
 */
export async function claimSeniorDevStart(
  taskId: number,
  userId: number,
): Promise<boolean> {
  const claimed = await db
    .update(schema.seniorDevTasks)
    .set({ status: "executing", updatedAt: new Date() })
    .where(
      and(
        eq(schema.seniorDevTasks.id, taskId),
        eq(schema.seniorDevTasks.userId, userId),
        eq(schema.seniorDevTasks.status, "planning"),
      ),
    )
    .returning({ id: schema.seniorDevTasks.id });

  return claimed.length === 1;
}

/** Restore a first-run claim if reservation charging fails before execution. */
export async function releaseSeniorDevStartClaim(
  taskId: number,
  userId: number,
): Promise<void> {
  await db
    .update(schema.seniorDevTasks)
    .set({ status: "planning", updatedAt: new Date() })
    .where(
      and(
        eq(schema.seniorDevTasks.id, taskId),
        eq(schema.seniorDevTasks.userId, userId),
        eq(schema.seniorDevTasks.status, "executing"),
      ),
    );
}

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
