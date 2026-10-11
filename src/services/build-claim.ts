import { and, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "../db.js";
import * as schema from "../db/schema.js";

const STARTABLE_BUILD_STATUSES = ["pending", "failed", "paused"];
type StartableBuildStatus = (typeof STARTABLE_BUILD_STATUSES)[number];

/**
 * Atomically claims a project for one build starter. Concurrent requests race
 * on the conditional UPDATE; exactly one can transition a startable project
 * to running and therefore proceed to charge/enqueue it. User-cancelled paused
 * projects remain non-startable even when a request is racing on stale state.
 */
export async function claimProjectBuildStart(
  projectId: number,
  userId: number,
): Promise<boolean> {
  const claimedAt = new Date();
  return db.transaction(async (tx) => {
    const claimed = await tx
      .update(schema.projects)
      .set({ status: "running", pauseReason: null, updatedAt: claimedAt })
      .where(
        and(
          eq(schema.projects.id, projectId),
          eq(schema.projects.userId, userId),
          inArray(schema.projects.status, STARTABLE_BUILD_STATUSES),
          or(
            ne(schema.projects.status, "paused"),
            and(
              eq(schema.projects.status, "paused"),
              or(
                isNull(schema.projects.pauseReason),
                and(
                  ne(schema.projects.pauseReason, "user_cancelled"),
                  ne(schema.projects.pauseReason, "user-cancelled"),
                ),
              ),
            ),
          ),
        ),
      )
      .returning({ id: schema.projects.id });

    if (claimed.length === 1) {
      await tx.insert(schema.buildEvents).values({
        projectId,
        event: "build_claim",
        payload: { claimedAt: claimedAt.toISOString() },
      });
    }
    return claimed.length === 1;
  });
}

/** Restore the state if charging or enqueueing fails after a successful claim. */
export async function releaseProjectBuildClaim(
  projectId: number,
  userId: number,
  previousStatus: string | null,
  previousPauseReason: string | null,
): Promise<void> {
  const rollbackStatus: StartableBuildStatus =
    previousStatus === "pending" ||
    previousStatus === "paused" ||
    previousStatus === "failed"
      ? previousStatus
      : "failed";

  await db
    .update(schema.projects)
    .set({
      status: rollbackStatus,
      pauseReason: previousPauseReason,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.projects.id, projectId),
        eq(schema.projects.userId, userId),
        eq(schema.projects.status, "running"),
      ),
    );
}

/** Pause only the exact running state inspected after a terminal queue failure. */
export async function pauseFailedQueueAttempt(
  projectId: number,
  userId: number,
  expectedUpdatedAt: Date,
  attemptCreatedAt: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const paused = await tx
      .update(schema.projects)
      .set({
        status: "paused",
        pauseReason: "retry_after_error",
        errorMessage:
          "The build worker stopped. Your approved decisions and saved files are preserved; retry to continue.",
        failureStage: "worker_interruption",
        creditsSpent: 0,
        creditsReserved: 0,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.projects.id, projectId),
          eq(schema.projects.userId, userId),
          eq(schema.projects.status, "running"),
          eq(schema.projects.updatedAt, expectedUpdatedAt),
          sql`NOT EXISTS (
          SELECT 1 FROM build_events
          WHERE project_id = ${projectId} AND event = 'build_claim'
          AND (payload->>'claimedAt')::timestamptz > ${attemptCreatedAt}::timestamptz
        )`,
        ),
      )
      .returning({ id: schema.projects.id });
    if (paused.length === 1) {
      await tx.insert(schema.buildEvents).values({
        projectId,
        event: "build_execution_claim",
        payload: {
          revoked: true,
          createdAt: attemptCreatedAt,
          reason: "worker_interruption",
        },
      });
    }
    return paused.length === 1;
  });
}
