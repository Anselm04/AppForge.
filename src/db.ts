import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./db/schema";
import { ENV } from "./_core/env";
import { eq, desc, and, gte, count } from "drizzle-orm";

const client = postgres(ENV.databaseUrl);
export const db = drizzle(client, { schema });

// ── USERS ──
export async function getUserById(id: number) {
  return db.query.users.findFirst({ where: eq(schema.users.id, id) });
}

export async function getUserByOpenId(openId: string) {
  return db.query.users.findFirst({ where: eq(schema.users.openId, openId) });
}

export async function createUser(data: {
  openId?: string;
  email?: string;
  name?: string;
  picture?: string;
}) {
  const result = await db.insert(schema.users).values(data).returning();
  return result[0];
}

// ── SUBSCRIPTIONS ──
export async function getSubscriptionByUserId(userId: number) {
  return db.query.subscriptions.findFirst({
    where: eq(schema.subscriptions.userId, userId),
  });
}

export async function isUserPro(userId: number) {
  const sub = await getSubscriptionByUserId(userId);
  if (!sub) return false;
  if (sub.status !== "active") return false;
  if (sub.currentPeriodEnd && sub.currentPeriodEnd < new Date()) return false;
  return true;
}

// ── GITHUB CONNECTIONS ──
export async function getGithubConnection(userId: number) {
  return db.query.githubConnections.findFirst({
    where: eq(schema.githubConnections.userId, userId),
  });
}

export async function upsertGithubConnection(data: {
  userId: number;
  githubUsername: string;
  accessToken: string;
}) {
  const existing = await getGithubConnection(data.userId);
  if (existing) {
    return db
      .update(schema.githubConnections)
      .set(data)
      .where(eq(schema.githubConnections.userId, data.userId))
      .returning()
      .then((r) => r[0]);
  }
  return db
    .insert(schema.githubConnections)
    .values(data)
    .returning()
    .then((r) => r[0]);
}

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
    .select({ value: count() })
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.userId, userId),
        gte(schema.projects.createdAt, startOfMonth)
      )
    );
  return Number(result[0]?.value ?? 0);
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
