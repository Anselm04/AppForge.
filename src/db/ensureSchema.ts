import postgres from "postgres";
import { ENV } from "../_core/env.js";

/**
 * Idempotent Drizzle schema for Fly Postgres.
 * Leftover supabase/migrations target auth.users and must not be applied here.
 */
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS "users" (
  "id" SERIAL PRIMARY KEY,
  "open_id" VARCHAR(255) UNIQUE,
  "email" VARCHAR(255) UNIQUE,
  "name" VARCHAR(255),
  "picture" TEXT,
  "is_banned" BOOLEAN DEFAULT FALSE,
  "banned_at" TIMESTAMP,
  "ban_reason" TEXT,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "stripe_customer_id" VARCHAR(255),
  "stripe_subscription_id" VARCHAR(255),
  "status" VARCHAR(50),
  "tier" VARCHAR(50) DEFAULT 'free',
  "trial_end" TIMESTAMP,
  "current_period_end" TIMESTAMP,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "github_connections" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "github_username" VARCHAR(255),
  "access_token" TEXT,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "user_credits" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "balance" INTEGER NOT NULL DEFAULT 0,
  "tier" VARCHAR(50) DEFAULT 'free',
  "monthly_allowance" INTEGER DEFAULT 0,
  "last_refill_at" TIMESTAMP DEFAULT NOW(),
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "credit_transactions" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER REFERENCES "users"("id") ON DELETE CASCADE,
  "amount" INTEGER NOT NULL,
  "type" VARCHAR(50) NOT NULL,
  "project_id" INTEGER,
  "stripe_payment_intent_id" VARCHAR(255),
  "description" TEXT,
  "created_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "projects" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER REFERENCES "users"("id") ON DELETE CASCADE,
  "title" VARCHAR(255),
  "description" TEXT,
  "tech_stack" VARCHAR(255) DEFAULT 'react-node',
  "status" VARCHAR(50) DEFAULT 'pending',
  "error_message" TEXT,
  "pause_reason" TEXT,
  "generated_files" JSONB,
  "credits_spent" INTEGER DEFAULT 0,
  "credits_reserved" INTEGER DEFAULT 0,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "agent_logs" (
  "id" SERIAL PRIMARY KEY,
  "project_id" INTEGER REFERENCES "projects"("id") ON DELETE CASCADE,
  "agent" VARCHAR(50),
  "content" TEXT,
  "credits_charged" INTEGER DEFAULT 0,
  "is_complete" BOOLEAN DEFAULT FALSE,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "cosine_improvements" (
  "id" SERIAL PRIMARY KEY,
  "project_id" INTEGER REFERENCES "projects"("id") ON DELETE CASCADE,
  "user_id" INTEGER REFERENCES "users"("id") ON DELETE CASCADE,
  "improvements" JSONB,
  "pr_url" TEXT,
  "status" VARCHAR(50) DEFAULT 'pending',
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "user_strikes" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "strike_number" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "content_snapshot" TEXT,
  "created_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "moderation_flags" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "project_id" INTEGER REFERENCES "projects"("id") ON DELETE CASCADE,
  "flagged_text" TEXT NOT NULL,
  "category" VARCHAR(50) NOT NULL,
  "auto_flagged" BOOLEAN DEFAULT TRUE,
  "admin_reviewed" BOOLEAN DEFAULT FALSE,
  "admin_action" VARCHAR(50),
  "created_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "god_codes" (
  "id" SERIAL PRIMARY KEY,
  "code_hash" VARCHAR(255) UNIQUE NOT NULL,
  "tier" VARCHAR(50) NOT NULL,
  "credits" INTEGER DEFAULT 0,
  "trial_days" INTEGER DEFAULT 0,
  "is_used" BOOLEAN DEFAULT FALSE,
  "used_by_user_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "used_at" TIMESTAMP,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "sms_verifications" (
  "id" SERIAL PRIMARY KEY,
  "code_id" INTEGER NOT NULL REFERENCES "god_codes"("id") ON DELETE CASCADE,
  "phone_number" VARCHAR(50) NOT NULL,
  "otp_hash" VARCHAR(255) NOT NULL,
  "expires_at" TIMESTAMP NOT NULL,
  "verified_at" TIMESTAMP,
  "created_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "compliance_records" (
  "id" SERIAL PRIMARY KEY,
  "record_type" VARCHAR(50) NOT NULL,
  "user_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "details" JSONB,
  "admin_email" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "user_sessions" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "ip_address" VARCHAR(50),
  "user_agent" TEXT,
  "country" VARCHAR(100),
  "created_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "cosine_connections" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "access_token" TEXT,
  "refresh_token" TEXT,
  "expires_at" TIMESTAMP,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "senior_dev_tasks" (
  "id" SERIAL PRIMARY KEY,
  "project_id" INTEGER NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "request" TEXT NOT NULL,
  "mode" VARCHAR(20) DEFAULT 'collaborative',
  "plan" JSONB,
  "plan_approved" BOOLEAN DEFAULT FALSE,
  "status" VARCHAR(50) DEFAULT 'planning',
  "changes" JSONB,
  "validation_result" JSONB,
  "summary" TEXT,
  "credits_spent" INTEGER DEFAULT 0,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "build_snapshots" (
  "id" SERIAL PRIMARY KEY,
  "project_id" INTEGER NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "version" INTEGER NOT NULL,
  "label" VARCHAR(255),
  "files" JSONB NOT NULL,
  "file_count" INTEGER NOT NULL,
  "tech_stack" VARCHAR(100),
  "validation_result" JSONB,
  "audit_scores" JSONB,
  "cost_estimate" JSONB,
  "is_current" BOOLEAN DEFAULT TRUE,
  "created_at" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "user_credits_balance_idx" ON "user_credits" ("balance");
CREATE INDEX IF NOT EXISTS "credit_tx_user_idx" ON "credit_transactions" ("user_id");
CREATE INDEX IF NOT EXISTS "credit_tx_type_idx" ON "credit_transactions" ("type");
CREATE INDEX IF NOT EXISTS "credit_tx_project_idx" ON "credit_transactions" ("project_id");
CREATE INDEX IF NOT EXISTS "projects_user_id_idx" ON "projects" ("user_id");
CREATE INDEX IF NOT EXISTS "projects_status_idx" ON "projects" ("status");
CREATE INDEX IF NOT EXISTS "projects_created_at_idx" ON "projects" ("created_at");
CREATE INDEX IF NOT EXISTS "projects_user_created_idx" ON "projects" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "agent_logs_project_idx" ON "agent_logs" ("project_id");
CREATE INDEX IF NOT EXISTS "agent_logs_agent_idx" ON "agent_logs" ("agent");
CREATE INDEX IF NOT EXISTS "agent_logs_project_created_idx" ON "agent_logs" ("project_id", "created_at");
CREATE INDEX IF NOT EXISTS "cosine_improvements_project_idx" ON "cosine_improvements" ("project_id");
CREATE INDEX IF NOT EXISTS "cosine_improvements_user_idx" ON "cosine_improvements" ("user_id");
CREATE INDEX IF NOT EXISTS "user_strikes_user_idx" ON "user_strikes" ("user_id");
CREATE INDEX IF NOT EXISTS "moderation_flags_user_idx" ON "moderation_flags" ("user_id");
CREATE INDEX IF NOT EXISTS "moderation_flags_category_idx" ON "moderation_flags" ("category");
CREATE INDEX IF NOT EXISTS "moderation_flags_reviewed_idx" ON "moderation_flags" ("admin_reviewed");
CREATE INDEX IF NOT EXISTS "god_codes_hash_idx" ON "god_codes" ("code_hash");
CREATE INDEX IF NOT EXISTS "god_codes_used_idx" ON "god_codes" ("is_used");
CREATE INDEX IF NOT EXISTS "sms_verifications_code_idx" ON "sms_verifications" ("code_id");
CREATE INDEX IF NOT EXISTS "sms_verifications_expires_idx" ON "sms_verifications" ("expires_at");
CREATE INDEX IF NOT EXISTS "compliance_records_type_idx" ON "compliance_records" ("record_type");
CREATE INDEX IF NOT EXISTS "compliance_records_user_idx" ON "compliance_records" ("user_id");
CREATE INDEX IF NOT EXISTS "user_sessions_user_idx" ON "user_sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "senior_dev_tasks_project_idx" ON "senior_dev_tasks" ("project_id");
CREATE INDEX IF NOT EXISTS "senior_dev_tasks_user_idx" ON "senior_dev_tasks" ("user_id");
CREATE INDEX IF NOT EXISTS "senior_dev_tasks_status_idx" ON "senior_dev_tasks" ("status");
CREATE INDEX IF NOT EXISTS "snapshots_project_version_idx" ON "build_snapshots" ("project_id", "version");
CREATE INDEX IF NOT EXISTS "snapshots_current_idx" ON "build_snapshots" ("is_current");
CREATE INDEX IF NOT EXISTS "snapshots_project_idx" ON "build_snapshots" ("project_id");
CREATE INDEX IF NOT EXISTS "subscriptions_user_id_idx" ON "subscriptions" ("user_id");
CREATE INDEX IF NOT EXISTS "github_connections_user_id_idx" ON "github_connections" ("user_id");
CREATE INDEX IF NOT EXISTS "cosine_connections_user_id_idx" ON "cosine_connections" ("user_id");

CREATE TABLE IF NOT EXISTS "app_settings" (
  "key" VARCHAR(100) PRIMARY KEY,
  "value" TEXT NOT NULL,
  "updated_at" TIMESTAMP DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE "user_credits" ADD CONSTRAINT "user_credits_balance_nonneg" CHECK ("balance" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
`;

const SCHEMA_PATCH_SQL = `
ALTER TABLE "user_credits" ADD COLUMN IF NOT EXISTS "unlimited" BOOLEAN DEFAULT FALSE;
ALTER TABLE "god_codes" ADD COLUMN IF NOT EXISTS "hash" VARCHAR(64);
ALTER TABLE "god_codes" ADD COLUMN IF NOT EXISTS "encrypted_code" TEXT;
ALTER TABLE "god_codes" ADD COLUMN IF NOT EXISTS "grant_type" VARCHAR(50);
ALTER TABLE "god_codes" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP;
ALTER TABLE "god_codes" ADD COLUMN IF NOT EXISTS "redeemed_at" TIMESTAMP;
ALTER TABLE "god_codes" ADD COLUMN IF NOT EXISTS "redeemed_by_user_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "god_codes_hash_unique" ON "god_codes" ("hash");
`;

export async function ensureAppSchema(): Promise<void> {
  if (!ENV.databaseUrl) {
    console.warn("Skipping schema ensure: DATABASE_URL is not set");
    return;
  }
  const sql = postgres(ENV.databaseUrl, { max: 1, prepare: false });
  try {
    await sql.unsafe(SCHEMA_SQL);
    await sql.unsafe(SCHEMA_PATCH_SQL);
    await upsertEncryptedOwner(sql);
    console.log("AppForge schema ensured");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function upsertEncryptedOwner(sql: postgres.Sql): Promise<void> {
  const { canonicalOwnerEmail, encryptOwnerEmail, ownerEmailHmac, isOwnerEmail } = await import("../lib/serverSecrets.js");
  const email = canonicalOwnerEmail();
  if (!isOwnerEmail(email)) return;
  await sql`
    INSERT INTO users (email, name, created_at, updated_at)
    VALUES (${email}, 'Anselm Perkins', NOW(), NOW())
    ON CONFLICT (email) DO UPDATE SET
      name = COALESCE(NULLIF("users"."name", ''), EXCLUDED.name),
      updated_at = NOW()
  `;
  try {
    const enc = encryptOwnerEmail(email);
    const hmac = ownerEmailHmac(email);
    await sql`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ('owner_email_enc', ${enc}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;
    await sql`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ('owner_email_hmac', ${hmac}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;
  } catch (err) {
    console.warn("Owner identity encrypt skipped (server secret not ready)");
  }
}
