import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./db/schema.js";
import { ENV } from "./_core/env.js";
import { eq, desc, and, gte } from "drizzle-orm";

// Connection pooling: max 10 connections, 30s idle timeout
const client = postgres(ENV.databaseUrl, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
  prepare: false, // Disable prepared statements for connection poolers (e.g., Supabase, PgBouncer)
});

export const db = drizzle(client, { schema });

// Graceful DB connection cleanup
export async function closeDbConnection(): Promise<void> {
  await client.end({ timeout: 5 });
}

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
  if (sub.status !== "active" && sub.status !== "trialing") return false;
  if (sub.currentPeriodEnd && sub.currentPeriodEnd < new Date()) return false;
  if (sub.trialEnd && sub.trialEnd < new Date() && sub.status === "trialing") return false;
  return true;
}

export async function getUserTier(userId: number): Promise<string> {
  const sub = await getSubscriptionByUserId(userId);
  if (sub && (sub.status === "active" || sub.status === "trialing")) {
    return sub.tier ?? "starter";
  }
  const credits = await getUserCredits(userId);
  return credits?.tier ?? "free";
}

const TIER_BUILD_LIMITS: Record<string, number | null> = {
  free: 3,
  starter: 16,
  builder: 66,
  studio: null,
  enterprise: null,
  custom: null,
};

export function getTierBuildLimit(tier: string): number | null {
  return TIER_BUILD_LIMITS[tier] ?? TIER_BUILD_LIMITS.free;
}

const TIER_CREDIT_REFILLS: Record<string, number | null> = {
  free: 20,
  starter: 100,
  builder: 400,
  studio: 1500,
  enterprise: null,
  custom: null,
};

export function getTierCreditRefill(tier: string): number | null {
  return TIER_CREDIT_REFILLS[tier] ?? TIER_CREDIT_REFILLS.free;
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

// ── CREDITS ──
export async function getUserCredits(userId: number) {
  return db.query.userCredits.findFirst({
    where: eq(schema.userCredits.userId, userId),
  });
}

export async function ensureUserCredits(userId: number) {
  const existing = await getUserCredits(userId);
  if (existing) return existing;

  // Default free tier credits
  const result = await db
    .insert(schema.userCredits)
    .values({ userId, balance: 20, tier: "free", monthlyAllowance: 3 })
    .returning();
  return result[0];
}

export async function refillMonthlyCredits(userId: number, tier?: string): Promise<void> {
  const credits = await getUserCredits(userId);
  if (!credits) return;

  const effectiveTier = tier ?? credits.tier ?? "free";
  const refillAmount = getTierCreditRefill(effectiveTier);
  if (refillAmount === null) return; // unlimited tiers don't need refills

  const now = new Date();
  const lastRefill = credits.lastRefillAt ?? credits.createdAt ?? now;
  const daysSinceRefill = (now.getTime() - new Date(lastRefill).getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceRefill >= 30) {
    await db.transaction(async (tx) => {
      await tx
        .update(schema.userCredits)
        .set({
          balance: refillAmount,
          tier: effectiveTier,
          monthlyAllowance: getTierBuildLimit(effectiveTier) ?? 0,
          lastRefillAt: now,
          updatedAt: now,
        })
        .where(eq(schema.userCredits.id, credits.id));

      await tx.insert(schema.creditTransactions).values({
        userId,
        amount: refillAmount,
        type: "subscription_grant",
        description: `Monthly credit refill for ${effectiveTier} tier (${refillAmount} credits)`,
      });
    });
  }
}

export async function syncTierFromSubscription(userId: number): Promise<void> {
  const sub = await getSubscriptionByUserId(userId);
  const credits = await getUserCredits(userId);
  const subTier = sub?.tier;
  if (!subTier || !credits) return;
  if (credits.tier !== subTier) {
    await db
      .update(schema.userCredits)
      .set({ tier: subTier, updatedAt: new Date() })
      .where(eq(schema.userCredits.id, credits.id));
  }
}

export async function deductCredits(userId: number, amount: number, projectId?: number, description?: string) {
  const credits = await getUserCredits(userId);
  if (!credits || credits.balance < amount) {
    throw new Error(`Insufficient credits: need ${amount}, have ${credits?.balance ?? 0}`);
  }
  const newBalance = credits.balance - amount;
  if (newBalance < 0) {
    throw new Error(`Credit underflow prevented: would result in ${newBalance}`);
  }
  await db.transaction(async (tx) => {
    await tx
      .update(schema.userCredits)
      .set({ balance: newBalance, updatedAt: new Date() })
      .where(eq(schema.userCredits.id, credits.id));
    await tx.insert(schema.creditTransactions).values({
      userId,
      amount: -amount,
      type: "build_usage",
      projectId: projectId ?? null,
      description: description ?? "Build agent usage",
    });
  });
  return newBalance;
}

export async function addCredits(userId: number, amount: number, type: string, description?: string, stripePaymentIntentId?: string) {
  const credits = await getUserCredits(userId);
  const currentBalance = credits?.balance ?? 0;
  await db.transaction(async (tx) => {
    if (credits) {
      await tx
        .update(schema.userCredits)
        .set({ balance: currentBalance + amount, updatedAt: new Date() })
        .where(eq(schema.userCredits.id, credits.id));
    } else {
      await tx.insert(schema.userCredits).values({
        userId,
        balance: amount,
        tier: "starter",
        monthlyAllowance: 0,
      });
    }
    await tx.insert(schema.creditTransactions).values({
      userId,
      amount,
      type,
      description: description ?? "Credit purchase",
      stripePaymentIntentId: stripePaymentIntentId ?? null,
    });
  });
  return currentBalance + amount;
}

export async function updateProjectCreditsSpent(projectId: number, spent: number) {
  await db
    .update(schema.projects)
    .set({ creditsSpent: spent, updatedAt: new Date() })
    .where(eq(schema.projects.id, projectId));
}

export async function pauseProject(projectId: number, reason: string) {
  await db
    .update(schema.projects)
    .set({ status: "paused", pauseReason: reason, updatedAt: new Date() })
    .where(eq(schema.projects.id, projectId));
}

export async function resumeProject(projectId: number) {
  await db
    .update(schema.projects)
    .set({ status: "running", pauseReason: null, updatedAt: new Date() })
    .where(eq(schema.projects.id, projectId));
}

export async function getCreditTransactions(userId: number) {
  return db.query.creditTransactions.findMany({
    where: eq(schema.creditTransactions.userId, userId),
    orderBy: desc(schema.creditTransactions.createdAt),
  });
}

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
