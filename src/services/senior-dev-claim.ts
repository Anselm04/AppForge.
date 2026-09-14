import { and, eq, inArray, lt } from "drizzle-orm";
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

/**
 * Refresh the persisted execution lease for a task that is still executing.
 * The lease belongs to the task/user pair rather than an SSE connection, so a
 * browser disconnect does not cancel valid work that is already in flight.
 */
export async function touchSeniorDevExecution(
  taskId: number,
  userId: number,
): Promise<boolean> {
  const touched = await db
    .update(schema.seniorDevTasks)
    .set({ updatedAt: new Date() })
    .where(
      and(
        eq(schema.seniorDevTasks.id, taskId),
        eq(schema.seniorDevTasks.userId, userId),
        eq(schema.seniorDevTasks.status, "executing"),
      ),
    )
    .returning({ id: schema.seniorDevTasks.id });

  return touched.length === 1;
}

/**
 * Atomically mark an abandoned execution as failed only when its persisted
 * heartbeat is older than the supplied cutoff. Active jobs keep updatedAt
 * fresh, preventing a reconnect from stealing a live execution.
 */
export async function failStaleSeniorDevExecution(
  taskId: number,
  userId: number,
  staleBefore: Date,
): Promise<boolean> {
  const failed = await db
    .update(schema.seniorDevTasks)
    .set({ status: "failed", updatedAt: new Date() })
    .where(
      and(
        eq(schema.seniorDevTasks.id, taskId),
        eq(schema.seniorDevTasks.userId, userId),
        eq(schema.seniorDevTasks.status, "executing"),
        lt(schema.seniorDevTasks.updatedAt, staleBefore),
      ),
    )
    .returning({ id: schema.seniorDevTasks.id });

  return failed.length === 1;
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
