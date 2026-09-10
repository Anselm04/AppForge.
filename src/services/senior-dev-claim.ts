import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db.js";
import * as schema from "../db/schema.js";

const STARTABLE_SENIOR_DEV_STATUSES = ["planning", "failed"];
type StartableSeniorDevStatus = (typeof STARTABLE_SENIOR_DEV_STATUSES)[number];

/**
 * Atomically claims a new or retryable Senior Dev task for execution.
 * Exactly one concurrent starter can transition planning/failed -> executing.
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
        inArray(schema.seniorDevTasks.status, STARTABLE_SENIOR_DEV_STATUSES),
      ),
    )
    .returning({ id: schema.seniorDevTasks.id });

  return claimed.length === 1;
}

/** Restore the pre-claim state if reservation charging fails before execution. */
export async function releaseSeniorDevStartClaim(
  taskId: number,
  userId: number,
  previousStatus: string | null,
): Promise<void> {
  const rollbackStatus: StartableSeniorDevStatus =
    previousStatus === "failed" ? "failed" : "planning";

  await db
    .update(schema.seniorDevTasks)
    .set({ status: rollbackStatus, updatedAt: new Date() })
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
