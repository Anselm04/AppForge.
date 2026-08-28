import { count, eq } from "drizzle-orm";
import { db } from "../db.js";
import * as schema from "../db/schema.js";

export async function recordBuildOutcome(
  userId: number,
  success: boolean,
  creditsSpent: number,
): Promise<void> {
  const existing = await db.query.userBuildStats.findFirst({
    where: eq(schema.userBuildStats.userId, userId),
  });
  if (!existing) {
    await db.insert(schema.userBuildStats).values({
      userId,
      totalBuilds: 1,
      successfulBuilds: success ? 1 : 0,
      failedBuilds: success ? 0 : 1,
      totalCreditsSpent: creditsSpent,
    });
    return;
  }
  await db
    .update(schema.userBuildStats)
    .set({
      totalBuilds: existing.totalBuilds + 1,
      successfulBuilds: existing.successfulBuilds + (success ? 1 : 0),
      failedBuilds: existing.failedBuilds + (success ? 0 : 1),
      totalCreditsSpent: existing.totalCreditsSpent + creditsSpent,
      updatedAt: new Date(),
    })
    .where(eq(schema.userBuildStats.userId, userId));
}

export async function recordDeploy(userId: number): Promise<void> {
  const existing = await db.query.userBuildStats.findFirst({
    where: eq(schema.userBuildStats.userId, userId),
  });
  if (!existing) {
    await db.insert(schema.userBuildStats).values({
      userId,
      totalDeploys: 1,
    });
    return;
  }
  await db
    .update(schema.userBuildStats)
    .set({
      totalDeploys: existing.totalDeploys + 1,
      updatedAt: new Date(),
    })
    .where(eq(schema.userBuildStats.userId, userId));
}

export async function getUserBuildStats(userId: number) {
  return db.query.userBuildStats.findFirst({
    where: eq(schema.userBuildStats.userId, userId),
  });
}

export async function getPlatformBuildMetrics() {
  const totals = await db
    .select({
      totalBuilds: count(schema.projects.id),
    })
    .from(schema.projects);
  const completed = await db
    .select({ count: count() })
    .from(schema.projects)
    .where(eq(schema.projects.status, "completed"));
  const failed = await db
    .select({ count: count() })
    .from(schema.projects)
    .where(eq(schema.projects.status, "failed"));
  const running = await db
    .select({ count: count() })
    .from(schema.projects)
    .where(eq(schema.projects.status, "running"));
  return {
    totalBuilds: totals[0]?.totalBuilds ?? 0,
    completed: completed[0]?.count ?? 0,
    failed: failed[0]?.count ?? 0,
    running: running[0]?.count ?? 0,
  };
}
