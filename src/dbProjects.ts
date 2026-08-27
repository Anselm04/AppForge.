import { eq, desc, and, gte } from "drizzle-orm";
import * as schema from "./db/schema.js";
import { db } from "./db.js";

// ── PROJECTS ──
export async function createProject(data: {
  userId: number;
  title: string;
  description: string;
  techStack: string;
  status: string;
}) {
  const result = await db
    .insert(schema.projects)
    .values(data)
    .returning({ id: schema.projects.id });
  return result[0].id;
}

export async function getProjectById(id: number) {
  return db.query.projects.findFirst({ where: eq(schema.projects.id, id) });
}

export async function getProjectsByUserId(userId: number) {
  return db.query.projects.findMany({
    where: eq(schema.projects.userId, userId),
    orderBy: desc(schema.projects.createdAt),
  });
}

export async function updateProjectStatus(
  id: number,
  status: string,
  errorMessage?: string
) {
  await db
    .update(schema.projects)
    .set({ status, errorMessage, updatedAt: new Date() })
    .where(eq(schema.projects.id, id));
}

export async function updateProjectFiles(
  id: number,
  files: Record<string, string>
) {
  await db
    .update(schema.projects)
    .set({
      generatedFiles: files,
      status: "completed",
      updatedAt: new Date(),
    })
    .where(eq(schema.projects.id, id));
}

export async function countBuildsThisMonth(userId: number) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const result = await db
    .select({ count: schema.projects.id })
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.userId, userId),
        gte(schema.projects.createdAt, startOfMonth)
      )
    );
  return result[0]?.count || 0;
}

// ── AGENT LOGS ──
export async function appendAgentLog(data: {
  projectId: number;
  agent: string;
  content: string;
  isComplete: boolean;
}) {
  const result = await db
    .insert(schema.agentLogs)
    .values(data)
    .returning({ id: schema.agentLogs.id });
  return result[0].id;
}

export async function markAgentLogComplete(id: number) {
  await db
    .update(schema.agentLogs)
    .set({ isComplete: true, updatedAt: new Date() })
    .where(eq(schema.agentLogs.id, id));
}

export async function getAgentLogsByProject(projectId: number) {
  return db.query.agentLogs.findMany({
    where: eq(schema.agentLogs.projectId, projectId),
    orderBy: desc(schema.agentLogs.createdAt),
  });
}

// ── COSINE IMPROVEMENTS ──
export async function createCosineImprovement(data: {
  projectId: number;
  userId: number;
  improvements: string[];
}) {
  const result = await db
    .insert(schema.cosineImprovements)
    .values(data)
    .returning({ id: schema.cosineImprovements.id });
  return result[0].id;
}

export async function getCosineImprovementById(id: number) {
  return db.query.cosineImprovements.findFirst({
    where: eq(schema.cosineImprovements.id, id),
  });
}

export async function updateCosineImprovement(
  id: number,
  data: { status?: string; prUrl?: string }
) {
  await db
    .update(schema.cosineImprovements)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(schema.cosineImprovements.id, id));
}
