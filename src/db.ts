import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./db/schema.js";
import { ENV } from "./_core/env.js";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { isOwnerEmail } from "./lib/owner.js";
import {
  buildProductContract,
  validateProductContract,
  withSelectedTechnologyStack,
  type ProductContract,
} from "./lib/productContract.js";
import {
  assertArtifactIntegrity,
  buildArtifactIntegrity,
  validateArtifactFiles,
  type ArtifactIntegrity,
} from "./lib/artifactIntegrity.js";
import {
  assertMustHaveRequirementsResolved,
  validateRequirementManifest,
  type RequirementManifest,
} from "./lib/requirementManifest.js";

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

/** Upsert a user from Supabase (or other) auth identity. */
export async function upsertUserFromAuth(data: {
  openId: string;
  email?: string;
  name?: string;
  picture?: string | null;
}) {
  return db.transaction(async (tx) => {
    // Multiple authenticated requests can arrive together immediately after
    // sign-in. Serialize first-login creation by the verified provider UID so
    // one request creates the canonical integer user row and the rest reuse it.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${data.openId}, 0))`,
    );

    const existing = await tx.query.users.findFirst({
      where: eq(schema.users.openId, data.openId),
    });
    if (existing) {
      const result = await tx
        .update(schema.users)
        .set({
          email: data.email || existing.email,
          name: data.name || existing.name,
          picture: data.picture ?? existing.picture,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, existing.id))
        .returning();
      return result[0] ?? existing;
    }

    const result = await tx
      .insert(schema.users)
      .values({
        openId: data.openId,
        email: data.email,
        name: data.name,
        picture: data.picture ?? undefined,
      })
      .returning();
    return result[0];
  });
}

/**
 * Apply a god-code grant: lifetime → unlimited credits; limited → add credits.
 */
export async function applyGodCodeGrant(
  userId: number,
  grantType: "lifetime" | "limited",
  credits: number,
): Promise<{ credits: number; unlimited: boolean }> {
  await ensureUserCredits(userId);
  const row = await getUserCredits(userId);
  if (!row) return { credits: 0, unlimited: false };

  const now = new Date();
  if (grantType === "lifetime") {
    await db
      .update(schema.userCredits)
      .set({
        unlimited: true,
        tier: "lifetime",
        updatedAt: now,
      })
      .where(eq(schema.userCredits.id, row.id));
    await db.insert(schema.creditTransactions).values({
      userId,
      amount: 0,
      type: "god_code_grant",
      description: "Lifetime unlimited credits (god code)",
    });
    await unpauseCreditExhaustedProjects(userId);
    return { credits: row.balance, unlimited: true };
  }

  const amount = Math.max(0, credits);
  const newBalance = row.balance + amount;
  await db.transaction(async (tx) => {
    await tx
      .update(schema.userCredits)
      .set({ balance: newBalance, updatedAt: now })
      .where(eq(schema.userCredits.id, row.id));
    if (amount > 0) {
      await tx.insert(schema.creditTransactions).values({
        userId,
        amount,
        type: "god_code_grant",
        description: `God code grant (+${amount} credits)`,
      });
    }
  });
  await unpauseCreditExhaustedProjects(userId);
  return { credits: newBalance, unlimited: !!row.unlimited };
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
  if (sub.trialEnd && sub.trialEnd < new Date() && sub.status === "trialing")
    return false;
  return true;
}

export async function getUserTier(userId: number): Promise<string> {
  const sub = await getSubscriptionByUserId(userId);
  const now = new Date();
  const activeStatus = sub?.status === "active" || sub?.status === "trialing";
  const periodValid = !sub?.currentPeriodEnd || sub.currentPeriodEnd >= now;
  const trialValid =
    sub?.status !== "trialing" || !sub.trialEnd || sub.trialEnd >= now;
  if (sub && activeStatus && periodValid && trialValid) {
    return sub.tier ?? "starter";
  }
  return "free";
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
  locale?: string;
  buildCapabilities?: string[];
  productContract?: ProductContract;
}) {
  let productContract = data.productContract;
  if (!productContract) {
    try {
      productContract = withSelectedTechnologyStack(
        buildProductContract(data.description),
        data.techStack,
      );
    } catch {
      productContract = undefined;
    }
  }
  if (productContract) {
    productContract = validateProductContract(productContract);
    if (productContract.originalPrompt !== data.description) {
      throw new Error("Product contract original prompt does not match project description");
    }
    if (productContract.selectedTechnologyStack !== data.techStack) {
      throw new Error("Product contract selected stack does not match project tech stack");
    }
  }

  const result = await db
    .insert(schema.projects)
    .values({
      userId: data.userId,
      title: data.title,
      description: data.description,
      techStack: data.techStack,
      status: data.status,
      locale: data.locale,
      buildCapabilities: data.buildCapabilities ?? [],
      productContract,
    })
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
  errorMessage?: string,
) {
  await db
    .update(schema.projects)
    .set({ status, errorMessage, updatedAt: new Date() })
    .where(eq(schema.projects.id, id));
}

export async function updateProjectFiles(
  id: number,
  files: Record<string, string>,
) {
  const normalized = validateArtifactFiles(files);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${id})`);
    const rows = await tx
      .select({
        workingArtifactVersion: schema.projects.workingArtifactVersion,
        workingArtifactIntegrity: schema.projects.workingArtifactIntegrity,
      })
      .from(schema.projects)
      .where(eq(schema.projects.id, id))
      .limit(1);
    const project = rows[0];
    if (!project) throw new Error("Project not found for working artifact");
    const artifactVersion = (project.workingArtifactVersion ?? 0) + 1;
    const integrity = buildArtifactIntegrity({
      projectId: id,
      artifactVersion,
      state: "working",
      files: normalized,
      previousIntegrity: project.workingArtifactIntegrity ?? null,
    });
    await tx
      .update(schema.projects)
      .set({
        generatedFiles: normalized,
        workingArtifactVersion: artifactVersion,
        workingArtifactIntegrity: integrity,
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, id));
    return integrity;
  });
}

export async function updateProjectRequirementManifest(
  id: number,
  requirementManifest: RequirementManifest,
) {
  const validated = validateRequirementManifest(requirementManifest);
  await db
    .update(schema.projects)
    .set({ requirementManifest: validated, updatedAt: new Date() })
    .where(eq(schema.projects.id, id));
}

export async function persistRequirementDeploymentEvidence(
  projectId: number,
  requirementManifest: RequirementManifest,
) {
  const validated = validateRequirementManifest(requirementManifest);
  await db.transaction(async (tx) => {
    await tx
      .update(schema.projects)
      .set({ requirementManifest: validated, updatedAt: new Date() })
      .where(eq(schema.projects.id, projectId));

    const current = await tx
      .select({ id: schema.buildSnapshots.id })
      .from(schema.buildSnapshots)
      .where(
        and(
          eq(schema.buildSnapshots.projectId, projectId),
          eq(schema.buildSnapshots.isCurrent, true),
        ),
      )
      .orderBy(desc(schema.buildSnapshots.createdAt))
      .limit(1);

    if (current[0]) {
      await tx
        .update(schema.buildSnapshots)
        .set({ requirementManifest: validated })
        .where(eq(schema.buildSnapshots.id, current[0].id));
    }
  });
}

export async function countBuildsThisMonth(userId: number) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.userId, userId),
        gte(schema.projects.createdAt, startOfMonth),
      ),
    );
  return Number(result[0]?.count ?? 0);
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
  data: { status?: string; prUrl?: string },
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
  const user = await getUserById(userId);
  const owner = isOwnerEmail(user?.email);

  const existing = await getUserCredits(userId);
  if (existing) {
    if (owner && !existing.unlimited) {
      const [updated] = await db
        .update(schema.userCredits)
        .set({ unlimited: true, updatedAt: new Date() })
        .where(eq(schema.userCredits.id, existing.id))
        .returning();
      return updated ?? { ...existing, unlimited: true };
    }
    return existing;
  }

  // Concurrent first requests must not race into duplicate rows/credits.
  // The configured AppForge owner is provisioned as unlimited automatically;
  // customer credit balances and billing rules remain unchanged.
  await db
    .insert(schema.userCredits)
    .values({
      userId,
      balance: 20,
      tier: "free",
      monthlyAllowance: 3,
      unlimited: owner,
    })
    .onConflictDoNothing({ target: schema.userCredits.userId });

  const created = await getUserCredits(userId);
  if (!created)
    throw new Error(`Failed to initialize credits for user ${userId}`);

  if (owner && !created.unlimited) {
    const [updated] = await db
      .update(schema.userCredits)
      .set({ unlimited: true, updatedAt: new Date() })
      .where(eq(schema.userCredits.id, created.id))
      .returning();
    return updated ?? { ...created, unlimited: true };
  }

  return created;
}

export async function refillMonthlyCredits(
  userId: number,
  tier?: string,
): Promise<void> {
  await ensureUserCredits(userId);
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${userId})`);
    const rows = await tx
      .select()
      .from(schema.userCredits)
      .where(eq(schema.userCredits.userId, userId))
      .limit(1);
    const credits = rows[0];
    if (!credits) return;

    const effectiveTier = tier ?? credits.tier ?? "free";
    const refillAmount = getTierCreditRefill(effectiveTier);
    if (refillAmount === null) return;

    const now = new Date();
    const lastRefill = credits.lastRefillAt ?? credits.createdAt ?? now;
    const daysSinceRefill =
      (now.getTime() - new Date(lastRefill).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceRefill < 30) return;

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

export async function deductCredits(
  userId: number,
  amount: number,
  projectId?: number,
  description?: string,
) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Credit deduction amount must be a positive integer");
  }
  await ensureUserCredits(userId);

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${userId})`);
    const rows = await tx
      .select()
      .from(schema.userCredits)
      .where(eq(schema.userCredits.userId, userId))
      .limit(1);
    const credits = rows[0];
    if (!credits)
      throw new Error(`Insufficient credits: need ${amount}, have 0`);

    if (credits.unlimited || credits.tier === "lifetime") {
      await tx.insert(schema.creditTransactions).values({
        userId,
        amount: 0,
        type: "build_usage",
        projectId: projectId ?? null,
        description: `${description ?? "Build agent usage"} (unlimited)`,
      });
      return credits.balance;
    }
    if (credits.balance < amount) {
      throw new Error(
        `Insufficient credits: need ${amount}, have ${credits.balance}`,
      );
    }

    const newBalance = credits.balance - amount;
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
    return newBalance;
  });
}

export async function addCredits(
  userId: number,
  amount: number,
  type: string,
  description?: string,
  stripePaymentIntentId?: string,
) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Credit grant amount must be a positive integer");
  }
  await ensureUserCredits(userId);

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${userId})`);

    if (stripePaymentIntentId) {
      const prior = await tx
        .select({ id: schema.creditTransactions.id })
        .from(schema.creditTransactions)
        .where(
          eq(
            schema.creditTransactions.stripePaymentIntentId,
            stripePaymentIntentId,
          ),
        )
        .limit(1);
      if (prior[0]) {
        const current = await tx
          .select({ balance: schema.userCredits.balance })
          .from(schema.userCredits)
          .where(eq(schema.userCredits.userId, userId))
          .limit(1);
        return { balance: current[0]?.balance ?? 0, skipped: true };
      }
    }

    const current = await tx
      .select()
      .from(schema.userCredits)
      .where(eq(schema.userCredits.userId, userId))
      .limit(1);
    const credits = current[0];
    if (!credits) throw new Error(`Credits row missing for user ${userId}`);
    const newBalance = credits.balance + amount;

    await tx
      .update(schema.userCredits)
      .set({ balance: newBalance, updatedAt: new Date() })
      .where(eq(schema.userCredits.id, credits.id));
    await tx.insert(schema.creditTransactions).values({
      userId,
      amount,
      type,
      description: description ?? "Credit purchase",
      stripePaymentIntentId: stripePaymentIntentId ?? null,
    });
    return { balance: newBalance, skipped: false };
  });

  if (!result.skipped) await unpauseCreditExhaustedProjects(userId);
  return result.balance;
}

/** Resume projects paused because the user ran out of credits. */
export async function unpauseCreditExhaustedProjects(userId: number) {
  await db
    .update(schema.projects)
    .set({ status: "pending", pauseReason: null, updatedAt: new Date() })
    .where(
      and(
        eq(schema.projects.userId, userId),
        eq(schema.projects.status, "paused"),
        eq(schema.projects.pauseReason, "credits_exhausted"),
      ),
    );
}

/**
 * Grant a plan's monthly credits. Idempotent per Stripe invoice/session
 * (and within a ~25 day window for the same tier) so checkout.session.completed
 * and invoice.paid can both call this without double-granting.
 */
export async function grantPlanCredits(
  userId: number,
  tier: string,
  idempotencyKey?: string,
): Promise<{ granted: number; skipped: boolean }> {
  await ensureUserCredits(userId);
  const refillAmount = getTierCreditRefill(tier);
  const now = new Date();

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${userId})`);

    if (idempotencyKey) {
      const prior = await tx
        .select({ id: schema.creditTransactions.id })
        .from(schema.creditTransactions)
        .where(
          eq(schema.creditTransactions.stripePaymentIntentId, idempotencyKey),
        )
        .limit(1);
      if (prior[0]) return { granted: 0, skipped: true };
    }

    const creditRows = await tx
      .select()
      .from(schema.userCredits)
      .where(eq(schema.userCredits.userId, userId))
      .limit(1);
    const credits = creditRows[0];
    if (!credits) return { granted: 0, skipped: true };

    const grants = await tx
      .select({ createdAt: schema.creditTransactions.createdAt })
      .from(schema.creditTransactions)
      .where(
        and(
          eq(schema.creditTransactions.userId, userId),
          eq(schema.creditTransactions.type, "subscription_grant"),
        ),
      )
      .orderBy(desc(schema.creditTransactions.createdAt))
      .limit(1);
    const recentGrant = grants[0];
    if (recentGrant?.createdAt && refillAmount !== null) {
      const daysSinceGrant =
        (now.getTime() - new Date(recentGrant.createdAt).getTime()) /
        (1000 * 60 * 60 * 24);
      const samePaidTier = (credits.tier ?? "free") === tier && tier !== "free";
      if (samePaidTier && daysSinceGrant < 25) {
        return { granted: 0, skipped: true };
      }
    }

    if (refillAmount === null) {
      await tx
        .update(schema.userCredits)
        .set({
          tier,
          monthlyAllowance: getTierBuildLimit(tier) ?? 0,
          lastRefillAt: now,
          updatedAt: now,
        })
        .where(eq(schema.userCredits.id, credits.id));
      return { granted: 0, skipped: false };
    }

    const newBalance = credits.balance + refillAmount;
    await tx
      .update(schema.userCredits)
      .set({
        balance: newBalance,
        tier,
        monthlyAllowance: getTierBuildLimit(tier) ?? 0,
        lastRefillAt: now,
        updatedAt: now,
      })
      .where(eq(schema.userCredits.id, credits.id));
    await tx.insert(schema.creditTransactions).values({
      userId,
      amount: refillAmount,
      type: "subscription_grant",
      description: `Plan credits for ${tier} (${refillAmount} credits)`,
      stripePaymentIntentId: idempotencyKey ?? null,
    });
    return { granted: refillAmount, skipped: false };
  });

  await unpauseCreditExhaustedProjects(userId);
  return result;
}

export async function updateProjectCreditsSpent(
  projectId: number,
  spent: number,
) {
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
  },
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
  requirementManifest: RequirementManifest;
}) {
  const requirementManifest = assertMustHaveRequirementsResolved(
    data.requirementManifest,
  );
  const files = validateArtifactFiles(data.files);
  if (data.fileCount !== Object.keys(files).length) {
    throw new Error("Snapshot fileCount does not match persisted artifact files");
  }
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${data.projectId})`);
    const projects = await tx
      .select({
        userId: schema.projects.userId,
        workingArtifactIntegrity: schema.projects.workingArtifactIntegrity,
      })
      .from(schema.projects)
      .where(eq(schema.projects.id, data.projectId))
      .limit(1);
    const project = projects[0];
    if (!project) throw new Error("Snapshot project does not exist");
    if (project.userId !== data.userId) {
      throw new Error("Snapshot user does not own the target project");
    }

    const artifactIntegrity = buildArtifactIntegrity({
      projectId: data.projectId,
      artifactVersion: data.version,
      state: "final",
      files,
      previousIntegrity: project.workingArtifactIntegrity ?? null,
    });

    const existingVersion = await tx
      .select({ id: schema.buildSnapshots.id })
      .from(schema.buildSnapshots)
      .where(
        and(
          eq(schema.buildSnapshots.projectId, data.projectId),
          eq(schema.buildSnapshots.version, data.version),
        ),
      )
      .limit(1);
    if (existingVersion[0]) {
      throw new Error(
        `Snapshot version ${data.version} already exists for project ${data.projectId}`,
      );
    }

    const result = await tx
      .insert(schema.buildSnapshots)
      .values({
        ...data,
        files,
        fileCount: artifactIntegrity.fileCount,
        requirementManifest,
        artifactIntegrity,
        isCurrent: false,
      })
      .returning({ id: schema.buildSnapshots.id });
    return result[0].id;
  });
}

export async function createAndActivateBuildSnapshot(data: {
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
  requirementManifest: RequirementManifest;
}): Promise<{ id: number; integrity: ArtifactIntegrity }> {
  const requirementManifest = assertMustHaveRequirementsResolved(
    data.requirementManifest,
  );
  const files = validateArtifactFiles(data.files);
  if (data.fileCount !== Object.keys(files).length) {
    throw new Error("Snapshot fileCount does not match persisted artifact files");
  }

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${data.projectId})`);

    const projects = await tx
      .select({
        userId: schema.projects.userId,
        workingArtifactIntegrity: schema.projects.workingArtifactIntegrity,
      })
      .from(schema.projects)
      .where(eq(schema.projects.id, data.projectId))
      .limit(1);
    const project = projects[0];
    if (!project) throw new Error("Snapshot project does not exist");
    if (project.userId !== data.userId) {
      throw new Error("Snapshot user does not own the target project");
    }

    const existingVersion = await tx
      .select({ id: schema.buildSnapshots.id })
      .from(schema.buildSnapshots)
      .where(
        and(
          eq(schema.buildSnapshots.projectId, data.projectId),
          eq(schema.buildSnapshots.version, data.version),
        ),
      )
      .limit(1);
    if (existingVersion[0]) {
      throw new Error(
        `Snapshot version ${data.version} already exists for project ${data.projectId}`,
      );
    }

    const artifactIntegrity = buildArtifactIntegrity({
      projectId: data.projectId,
      artifactVersion: data.version,
      state: "final",
      files,
      previousIntegrity: project.workingArtifactIntegrity ?? null,
    });

    const inserted = await tx
      .insert(schema.buildSnapshots)
      .values({
        ...data,
        files,
        fileCount: artifactIntegrity.fileCount,
        requirementManifest,
        artifactIntegrity,
        isCurrent: false,
      })
      .returning({ id: schema.buildSnapshots.id });
    const id = inserted[0]?.id;
    if (!id) throw new Error("Failed to persist final artifact snapshot");

    // The final snapshot write, current-pointer switch and completed project
    // state are one transaction. A partial/new snapshot can never become
    // externally current unless every step commits together.
    await tx
      .update(schema.buildSnapshots)
      .set({ isCurrent: false })
      .where(eq(schema.buildSnapshots.projectId, data.projectId));
    await tx
      .update(schema.buildSnapshots)
      .set({ isCurrent: true })
      .where(
        and(
          eq(schema.buildSnapshots.id, id),
          eq(schema.buildSnapshots.projectId, data.projectId),
        ),
      );
    await tx
      .update(schema.projects)
      .set({
        requirementManifest,
        status: "completed",
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, data.projectId));

    return { id, integrity: artifactIntegrity };
  });

  const { invalidatePreviewCache } = await import("./routes/livePreview.js");
  invalidatePreviewCache(data.projectId);
  return result;
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
      eq(schema.buildSnapshots.isCurrent, true),
    ),
    orderBy: desc(schema.buildSnapshots.createdAt),
  });
}

/** Deployment/preview files must come only from the validated current snapshot. */
export async function getProjectFiles(
  projectId: number,
): Promise<Record<string, string>> {
  return (await getCurrentArtifact(projectId))?.files ?? {};
}

export async function getSnapshotArtifact(
  snapshotId: number,
  projectId: number,
): Promise<{
  snapshotId: number;
  version: number;
  files: Record<string, string>;
  integrity: ArtifactIntegrity;
} | null> {
  const snapshot = await db.query.buildSnapshots.findFirst({
    where: and(
      eq(schema.buildSnapshots.id, snapshotId),
      eq(schema.buildSnapshots.projectId, projectId),
    ),
  });
  if (!snapshot) return null;
  const files = validateArtifactFiles(
    (snapshot.files as Record<string, string> | null) ?? {},
  );
  const persistedIntegrity =
    snapshot.artifactIntegrity ??
    buildArtifactIntegrity({
      projectId,
      artifactVersion: snapshot.version,
      state: "final",
      files,
    });
  const integrity = assertArtifactIntegrity({
    files,
    integrity: persistedIntegrity,
    projectId,
    artifactVersion: snapshot.version,
    requiredState: "final",
  });
  if (!snapshot.artifactIntegrity) {
    await db
      .update(schema.buildSnapshots)
      .set({ artifactIntegrity: integrity })
      .where(
        and(
          eq(schema.buildSnapshots.id, snapshotId),
          eq(schema.buildSnapshots.projectId, projectId),
        ),
      );
  }
  return { snapshotId, version: snapshot.version, files, integrity };
}

export async function getCurrentArtifact(projectId: number): Promise<{
  snapshotId: number;
  version: number;
  files: Record<string, string>;
  integrity: ArtifactIntegrity;
} | null> {
  const snapshot = await getCurrentSnapshot(projectId);
  if (!snapshot) return null;
  const files = validateArtifactFiles(
    (snapshot.files as Record<string, string> | null) ?? {},
  );
  const persistedIntegrity =
    snapshot.artifactIntegrity ??
    buildArtifactIntegrity({
      projectId,
      artifactVersion: snapshot.version,
      state: "final",
      files,
    });
  const integrity = assertArtifactIntegrity({
    files,
    integrity: persistedIntegrity,
    projectId,
    artifactVersion: snapshot.version,
    requiredState: "final",
  });
  if (!snapshot.artifactIntegrity) {
    await db
      .update(schema.buildSnapshots)
      .set({ artifactIntegrity: integrity })
      .where(
        and(
          eq(schema.buildSnapshots.id, snapshot.id),
          eq(schema.buildSnapshots.projectId, projectId),
        ),
      );
  }
  return {
    snapshotId: snapshot.id,
    version: snapshot.version,
    files,
    integrity,
  };
}

export async function getWorkingProjectFiles(
  projectId: number,
): Promise<Record<string, string>> {
  const project = await getProjectById(projectId);
  if (!project?.generatedFiles) return {};
  const files = validateArtifactFiles(
    project.generatedFiles as Record<string, string>,
  );
  let artifactVersion = project.workingArtifactVersion ?? 0;
  let integrity = project.workingArtifactIntegrity;

  if (!integrity || artifactVersion <= 0) {
    artifactVersion = Math.max(1, artifactVersion);
    integrity = buildArtifactIntegrity({
      projectId,
      artifactVersion,
      state: "working",
      files,
    });
    await db
      .update(schema.projects)
      .set({
        workingArtifactVersion: artifactVersion,
        workingArtifactIntegrity: integrity,
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, projectId));
  }

  assertArtifactIntegrity({
    files,
    integrity,
    projectId,
    artifactVersion,
    requiredState: "working",
  });
  return files;
}

export async function getEditableProjectFiles(
  projectId: number,
): Promise<Record<string, string>> {
  const working = await getWorkingProjectFiles(projectId);
  if (Object.keys(working).length > 0) return working;
  return getProjectFiles(projectId);
}

export async function markSnapshotAsCurrent(id: number, projectId: number) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${projectId})`);
    const snapshots = await tx
      .select({
        id: schema.buildSnapshots.id,
        version: schema.buildSnapshots.version,
        files: schema.buildSnapshots.files,
        artifactIntegrity: schema.buildSnapshots.artifactIntegrity,
        requirementManifest: schema.buildSnapshots.requirementManifest,
      })
      .from(schema.buildSnapshots)
      .where(
        and(
          eq(schema.buildSnapshots.id, id),
          eq(schema.buildSnapshots.projectId, projectId),
        ),
      )
      .limit(1);
    const snapshot = snapshots[0];
    if (!snapshot) {
      throw new Error("Snapshot not found for project");
    }
    const requirementManifest = assertMustHaveRequirementsResolved(
      snapshot.requirementManifest,
    );
    const files = validateArtifactFiles(
      snapshot.files as Record<string, string>,
    );
    const integrity =
      snapshot.artifactIntegrity ??
      buildArtifactIntegrity({
        projectId,
        artifactVersion: snapshot.version,
        state: "final",
        files,
      });
    assertArtifactIntegrity({
      files,
      integrity,
      projectId,
      artifactVersion: snapshot.version,
      requiredState: "final",
    });
    if (!snapshot.artifactIntegrity) {
      await tx
        .update(schema.buildSnapshots)
        .set({ artifactIntegrity: integrity })
        .where(eq(schema.buildSnapshots.id, id));
    }

    await tx
      .update(schema.buildSnapshots)
      .set({ isCurrent: false })
      .where(eq(schema.buildSnapshots.projectId, projectId));
    await tx
      .update(schema.buildSnapshots)
      .set({ isCurrent: true })
      .where(eq(schema.buildSnapshots.id, id));
    await tx
      .update(schema.projects)
      .set({
        requirementManifest,
        status: "completed",
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, projectId));
  });

  const { invalidatePreviewCache } = await import("./routes/livePreview.js");
  invalidatePreviewCache(projectId);
}

export async function appendArtifactToCurrentSnapshot(input: {
  projectId: number;
  path: string;
  content: string;
}): Promise<{
  snapshotId: number;
  version: number;
  files: Record<string, string>;
  integrity: ArtifactIntegrity;
}> {
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${input.projectId})`);

    const projects = await tx
      .select({
        id: schema.projects.id,
        userId: schema.projects.userId,
        techStack: schema.projects.techStack,
        requirementManifest: schema.projects.requirementManifest,
        workingArtifactVersion: schema.projects.workingArtifactVersion,
        workingArtifactIntegrity: schema.projects.workingArtifactIntegrity,
      })
      .from(schema.projects)
      .where(eq(schema.projects.id, input.projectId))
      .limit(1);
    const project = projects[0];
    if (!project?.userId) {
      throw new Error("Artifact project does not exist or has no owner");
    }

    const currents = await tx
      .select()
      .from(schema.buildSnapshots)
      .where(
        and(
          eq(schema.buildSnapshots.projectId, input.projectId),
          eq(schema.buildSnapshots.isCurrent, true),
        ),
      )
      .orderBy(desc(schema.buildSnapshots.createdAt))
      .limit(1);
    const current = currents[0];
    if (!current) {
      throw new Error(
        "Artifact revision requires a validated current snapshot",
      );
    }

    const currentFiles = validateArtifactFiles(
      current.files as Record<string, string>,
    );
    const currentIntegrity =
      current.artifactIntegrity ??
      buildArtifactIntegrity({
        projectId: input.projectId,
        artifactVersion: current.version,
        state: "final",
        files: currentFiles,
      });
    assertArtifactIntegrity({
      files: currentFiles,
      integrity: currentIntegrity,
      projectId: input.projectId,
      artifactVersion: current.version,
      requiredState: "final",
    });

    const files = validateArtifactFiles({
      ...currentFiles,
      [input.path]: input.content,
    });
    const versions = await tx
      .select({ maxVersion: schema.buildSnapshots.version })
      .from(schema.buildSnapshots)
      .where(eq(schema.buildSnapshots.projectId, input.projectId))
      .orderBy(desc(schema.buildSnapshots.version))
      .limit(1);
    const version = (versions[0]?.maxVersion ?? 0) + 1;
    const requirementManifest = assertMustHaveRequirementsResolved(
      current.requirementManifest ?? project.requirementManifest,
    );
    const integrity = buildArtifactIntegrity({
      projectId: input.projectId,
      artifactVersion: version,
      state: "final",
      files,
      previousIntegrity: currentIntegrity,
    });

    const inserted = await tx
      .insert(schema.buildSnapshots)
      .values({
        projectId: input.projectId,
        userId: project.userId,
        version,
        label: `v${version} — artifact update`,
        files,
        fileCount: integrity.fileCount,
        techStack: current.techStack ?? project.techStack,
        validationResult: current.validationResult,
        auditScores: current.auditScores,
        costEstimate: current.costEstimate,
        requirementManifest,
        artifactIntegrity: integrity,
        isCurrent: false,
      })
      .returning({ id: schema.buildSnapshots.id });
    const snapshotId = inserted[0]?.id;
    if (!snapshotId) {
      throw new Error("Failed to persist artifact snapshot revision");
    }

    await tx
      .update(schema.buildSnapshots)
      .set({ isCurrent: false })
      .where(eq(schema.buildSnapshots.projectId, input.projectId));
    await tx
      .update(schema.buildSnapshots)
      .set({ isCurrent: true })
      .where(eq(schema.buildSnapshots.id, snapshotId));

    const workingArtifactVersion =
      (project.workingArtifactVersion ?? 0) + 1;
    const workingArtifactIntegrity = buildArtifactIntegrity({
      projectId: input.projectId,
      artifactVersion: workingArtifactVersion,
      state: "working",
      files,
      previousIntegrity: project.workingArtifactIntegrity ?? currentIntegrity,
    });

    await tx
      .update(schema.projects)
      .set({
        generatedFiles: files,
        workingArtifactVersion,
        workingArtifactIntegrity,
        requirementManifest,
        status: "completed",
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, input.projectId));

    return { snapshotId, version, files, integrity };
  });

  const { invalidatePreviewCache } = await import("./routes/livePreview.js");
  invalidatePreviewCache(input.projectId);
  return result;
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
