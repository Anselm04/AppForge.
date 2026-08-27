import { eq, desc, and, gte } from "drizzle-orm";
import * as schema from "./db/schema.js";
import { db } from "./db.js";

// ── SENIOR DEV TASKS ──
export async function createSeniorDevTask(data: {
  projectId: number;
  userId: number;
  request: string;
  mode: string;
}) {
  const result = await db
    .insert(schema.seniorDevTasks)
    .values(data)
    .returning({ id: schema.seniorDevTasks.id });
  return result[0].id;
}

export async function getSeniorDevTaskById(id: number) {
  return db.query.seniorDevTasks.findFirst({
    where: eq(schema.seniorDevTasks.id, id),
  });
}

export async function getSeniorDevTasksByProject(projectId: number) {
  return db.query.seniorDevTasks.findMany({
    where: eq(schema.seniorDevTasks.projectId, projectId),
    orderBy: desc(schema.seniorDevTasks.createdAt),
  });
}

export async function updateSeniorDevTask(
  id: number,
  data: {
    status?: string;
    plan?: any;
    planApproved?: boolean;
    changes?: any;
    validationResult?: any;
    summary?: string;
    creditsSpent?: number;
  }
) {
  await db
    .update(schema.seniorDevTasks)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(schema.seniorDevTasks.id, id));
}

export async function updateSeniorDevTaskStatus(id: number, status: string) {
  await db
    .update(schema.seniorDevTasks)
    .set({ status, updatedAt: new Date() })
    .where(eq(schema.seniorDevTasks.id, id));
}

export async function deleteSeniorDevTask(id: number) {
  await db
    .delete(schema.seniorDevTasks)
    .where(eq(schema.seniorDevTasks.id, id));
}

// ── BUILD SNAPSHOTS ──
export async function createBuildSnapshot(data: {
  projectId: number;
  userId: number;
  version: number;
  label?: string;
  files: Record<string, string>;
  fileCount: number;
  techStack: string;
  validationResult?: any;
  auditScores?: any;
  costEstimate?: any;
}) {
  const result = await db
    .insert(schema.buildSnapshots)
    .values(data)
    .returning({ id: schema.buildSnapshots.id });
  return result[0].id;
}

export async function getSnapshotsByProject(projectId: number) {
  return db.query.buildSnapshots.findMany({
    where: eq(schema.buildSnapshots.projectId, projectId),
    orderBy: desc(schema.buildSnapshots.createdAt),
  });
}

export async function getSnapshotById(id: number) {
  return db.query.buildSnapshots.findFirst({
    where: eq(schema.buildSnapshots.id, id),
  });
}

export async function getCurrentSnapshot(projectId: number) {
  return db.query.buildSnapshots.findFirst({
    where: and(
      eq(schema.buildSnapshots.projectId, projectId),
      eq(schema.buildSnapshots.isCurrent, true)
    ),
    orderBy: desc(schema.buildSnapshots.createdAt),
  });
}

export async function markSnapshotAsCurrent(id: number, projectId: number) {
  await db.transaction(async (tx) => {
    await tx
      .update(schema.buildSnapshots)
      .set({ isCurrent: false })
      .where(eq(schema.buildSnapshots.projectId, projectId));
    await tx
      .update(schema.buildSnapshots)
      .set({ isCurrent: true })
      .where(eq(schema.buildSnapshots.id, id));
  });
}

export async function getNextVersion(projectId: number): Promise<number> {
  const result = await db
    .select({ maxVersion: schema.buildSnapshots.version })
    .from(schema.buildSnapshots)
    .where(eq(schema.buildSnapshots.projectId, projectId))
    .orderBy(desc(schema.buildSnapshots.version))
    .limit(1);
  return (result[0]?.maxVersion ?? 0) + 1;
}
