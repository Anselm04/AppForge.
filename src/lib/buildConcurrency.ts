import { db } from "../db.js";
import { eq, and, sql } from "drizzle-orm";
import * as schema from "../db/schema.js";

export function maxConcurrentBuildsPerUser(): number {
  const raw = parseInt(process.env.BUILD_CONCURRENCY_PER_USER ?? "2", 10);
  if (Number.isNaN(raw) || raw < 1) return 2;
  return Math.min(raw, 5);
}

export async function countActiveBuildsForUser(
  userId: number,
): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.userId, userId),
        eq(schema.projects.status, "running"),
      ),
    );
  return result[0]?.count ?? 0;
}

export async function canStartBuild(userId: number): Promise<{
  allowed: boolean;
  active: number;
  limit: number;
}> {
  const limit = maxConcurrentBuildsPerUser();
  const active = await countActiveBuildsForUser(userId);
  return { allowed: active < limit, active, limit };
}
