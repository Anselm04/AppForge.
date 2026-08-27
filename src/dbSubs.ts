import { eq, desc, and, gte } from "drizzle-orm";
import * as schema from "./db/schema.js";
import { db } from "./db.js";

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

