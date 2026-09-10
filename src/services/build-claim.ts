import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db.js";
import * as schema from "../db/schema.js";

const STARTABLE_BUILD_STATUSES = ["pending", "failed", "paused"];

/**
 * Atomically claims a project for one build starter. Concurrent requests race
 * on the conditional UPDATE; exactly one can transition a startable project
 * to running and therefore proceed to charge/enqueue it.
 */
export async function claimProjectBuildStart(
  projectId: number,
  userId: number,
): Promise<boolean> {
  const claimed = await db
    .update(schema.projects)
    .set({ status: "running", pauseReason: null, updatedAt: new Date() })
    .where(
      and(
        eq(schema.projects.id, projectId),
        eq(schema.projects.userId, userId),
        inArray(schema.projects.status, STARTABLE_BUILD_STATUSES),
      ),
    )
    .returning({ id: schema.projects.id });

  return claimed.length === 1;
}

/** Restore the state if charging or enqueueing fails after a successful claim. */
export async function releaseProjectBuildClaim(
  projectId: number,
  userId: number,
  previousStatus: string,
  previousPauseReason: string | null,
): Promise<void> {
  await db
    .update(schema.projects)
    .set({
      status: previousStatus,
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
