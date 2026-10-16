import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { db, getSubscriptionByUserId, getUserById } from "../db.js";
import {
  DEFAULT_ACCOUNT_PREFERENCES,
  normalizeAccountPreferences,
  type AccountDeletionDependencies,
  type AccountPreferences,
} from "../lib/accountLifecycle.js";
import { getAppForgeStripe } from "./appForgeStripe.js";
import { deleteSupabaseAuthUser } from "./supabaseAccountAdmin.js";

type LifecycleRow = {
  user_id: number;
  language: string;
  communication_preferences: AccountPreferences["communications"];
  accessibility_preferences: AccountPreferences["accessibility"];
  deletion_state: "active" | "pending" | "completed";
  deletion_requested_at: Date | null;
  deleted_at: Date | null;
  deletion_subject_ref: string | null;
};

function rows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

async function ensureLifecycleRow(userId: number): Promise<void> {
  await db.execute(sql`
    INSERT INTO account_lifecycle (user_id)
    VALUES (${userId})
    ON CONFLICT (user_id) DO NOTHING
  `);
}

export async function getAccountLifecycleState(
  userId: number,
): Promise<LifecycleRow["deletion_state"]> {
  await ensureLifecycleRow(userId);
  const result = await db.execute<LifecycleRow>(sql`
    SELECT deletion_state
    FROM account_lifecycle
    WHERE user_id = ${userId}
  `);
  return rows<LifecycleRow>(result)[0]?.deletion_state ?? "active";
}

export async function getAccountLifecycleProfile(userId: number) {
  const user = await getUserById(userId);
  if (!user) throw new Error("Account not found");
  await ensureLifecycleRow(userId);
  const result = await db.execute<LifecycleRow>(sql`
    SELECT user_id, language, communication_preferences,
      accessibility_preferences, deletion_state,
      deletion_requested_at, deleted_at, deletion_subject_ref
    FROM account_lifecycle
    WHERE user_id = ${userId}
  `);
  const lifecycle = rows<LifecycleRow>(result)[0];
  const preferences = normalizeAccountPreferences({
    language: lifecycle?.language,
    communications: lifecycle?.communication_preferences,
    accessibility: lifecycle?.accessibility_preferences,
  });

  return {
    id: user.id,
    email: user.email ?? null,
    name: user.name ?? null,
    picture: user.picture ?? null,
    preferences,
    deletionState: lifecycle?.deletion_state ?? "active",
    deletionRequestedAt: lifecycle?.deletion_requested_at ?? null,
    deletedAt: lifecycle?.deleted_at ?? null,
  };
}

export async function updateAccountLifecycleProfile(
  userId: number,
  input: { name?: string | null; preferences?: Partial<AccountPreferences> },
) {
  const user = await getUserById(userId);
  if (!user) throw new Error("Account not found");
  if ((await getAccountLifecycleState(userId)) !== "active") {
    throw new Error("Account changes are disabled while deletion is in progress");
  }

  const current = await getAccountLifecycleProfile(userId);
  const preferences = normalizeAccountPreferences({
    ...current.preferences,
    ...input.preferences,
    communications: {
      ...current.preferences.communications,
      ...input.preferences?.communications,
    },
    accessibility: {
      ...current.preferences.accessibility,
      ...input.preferences?.accessibility,
    },
  });
  const name =
    input.name === undefined
      ? user.name
      : input.name?.trim().slice(0, 255) || null;

  await db.transaction(async (tx) => {
    await tx
      .update((await import("../db/schema.js")).users)
      .set({ name, updatedAt: new Date() })
      .where(sql`id = ${userId}`);
    await tx.execute(sql`
      INSERT INTO account_lifecycle (
        user_id, language, communication_preferences,
        accessibility_preferences, updated_at
      ) VALUES (
        ${userId}, ${preferences.language},
        ${JSON.stringify(preferences.communications)}::jsonb,
        ${JSON.stringify(preferences.accessibility)}::jsonb,
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        language = EXCLUDED.language,
        communication_preferences = EXCLUDED.communication_preferences,
        accessibility_preferences = EXCLUDED.accessibility_preferences,
        updated_at = NOW()
    `);
  });

  return getAccountLifecycleProfile(userId);
}

async function cancelBillingForDeletion(userId: number): Promise<void> {
  const subscription = await getSubscriptionByUserId(userId);
  if (
    subscription?.stripeSubscriptionId &&
    !["canceled", "incomplete_expired"].includes(subscription.status ?? "")
  ) {
    const stripe = await getAppForgeStripe();
    await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
  }
  await db.execute(sql`
    UPDATE subscriptions
    SET status = 'canceled', tier = 'free', updated_at = NOW()
    WHERE user_id = ${userId}
  `);
}

async function beginDeletion(userId: number): Promise<void> {
  const subjectRef = randomBytes(32).toString("hex");
  await ensureLifecycleRow(userId);
  await db.execute(sql`
    UPDATE account_lifecycle
    SET deletion_state = 'pending',
        deletion_requested_at = COALESCE(deletion_requested_at, NOW()),
        deletion_subject_ref = COALESCE(deletion_subject_ref, ${subjectRef}),
        updated_at = NOW()
    WHERE user_id = ${userId} AND deletion_state = 'active'
  `);
}

async function stopCustomerWork(userId: number): Promise<void> {
  await db.execute(sql`
    UPDATE projects
    SET status = 'paused',
        pause_reason = 'account_deletion_pending',
        credits_reserved = 0,
        updated_at = NOW()
    WHERE user_id = ${userId}
      AND status IN ('draft', 'planning', 'pending', 'running', 'paused')
  `);
}

async function disableEntitlements(userId: number): Promise<void> {
  await cancelBillingForDeletion(userId);
  await db.execute(sql`
    UPDATE user_credits
    SET balance = 0,
        monthly_allowance = 0,
        unlimited = FALSE,
        tier = 'free',
        updated_at = NOW()
    WHERE user_id = ${userId}
  `);
}

async function deleteCustomerProjects(userId: number): Promise<void> {
  await db.execute(sql`DELETE FROM projects WHERE user_id = ${userId}`);
}

async function deleteProviderConnections(userId: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`DELETE FROM github_connections WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM cosine_connections WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM user_sessions WHERE user_id = ${userId}`);
  });
}

async function anonymizeAccount(userId: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      UPDATE users
      SET open_id = NULL,
          email = NULL,
          name = NULL,
          picture = NULL,
          updated_at = NOW()
      WHERE id = ${userId}
    `);
    await tx.execute(sql`
      UPDATE account_lifecycle
      SET deletion_state = 'completed', deleted_at = NOW(), updated_at = NOW()
      WHERE user_id = ${userId}
    `);
  });
}

async function recordDeletionAudit(userId: number): Promise<void> {
  const result = await db.execute<{ deletion_subject_ref: string | null }>(sql`
    SELECT deletion_subject_ref
    FROM account_lifecycle
    WHERE user_id = ${userId}
  `);
  const subjectRef = rows<{ deletion_subject_ref: string | null }>(result)[0]
    ?.deletion_subject_ref;
  if (!subjectRef) throw new Error("Deletion audit subject is unavailable");

  await db.execute(sql`
    INSERT INTO account_lifecycle_events (subject_ref, event_type, details)
    VALUES (${subjectRef}, 'account_deletion_completed', ${JSON.stringify({ version: 1 })}::jsonb)
  `);
}

export function productionAccountDeletionDependencies(): AccountDeletionDependencies {
  return {
    loadUser: getUserById,
    beginDeletion,
    stopCustomerWork,
    disableEntitlements,
    revokeIdentity: deleteSupabaseAuthUser,
    deleteCustomerProjects,
    deleteProviderConnections,
    anonymizeAccount,
    recordAudit: recordDeletionAudit,
  };
}
