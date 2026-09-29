import { createHash } from "node:crypto";
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
  "working_artifact_version" INTEGER NOT NULL DEFAULT 0,
  "working_artifact_integrity" JSONB,
  "credits_spent" INTEGER DEFAULT 0,
  "credits_reserved" INTEGER DEFAULT 0,
  "product_contract" JSONB,
  "research_record" JSONB,
  "product_plan" JSONB,
  "agent_coordination" JSONB,
  "requirement_manifest" JSONB,
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
  "requirement_manifest" JSONB,
  "artifact_integrity" JSONB,
  "is_current" BOOLEAN DEFAULT FALSE,
  "created_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "recovery_checkpoints" (
  "id" SERIAL PRIMARY KEY,
  "project_id" INTEGER NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "snapshot_id" INTEGER NOT NULL REFERENCES "build_snapshots"("id") ON DELETE CASCADE,
  "artifact_version" INTEGER NOT NULL,
  "artifact_sha256" VARCHAR(64) NOT NULL,
  "deployment_version" INTEGER,
  "deployment_manifest_sha256" VARCHAR(64),
  "live_url" TEXT,
  "source" VARCHAR(32) NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "user_credits_balance_idx" ON "user_credits" ("balance");
CREATE INDEX IF NOT EXISTS "credit_tx_user_idx" ON "credit_transactions" ("user_id");
CREATE INDEX IF NOT EXISTS "credit_tx_type_idx" ON "credit_transactions" ("type");
CREATE INDEX IF NOT EXISTS "credit_tx_project_idx" ON "credit_transactions" ("project_id");
CREATE UNIQUE INDEX IF NOT EXISTS "credit_tx_stripe_ref_unique" ON "credit_transactions" ("stripe_payment_intent_id");

CREATE TABLE IF NOT EXISTS "stripe_webhook_events" (
  "event_id" VARCHAR(255) PRIMARY KEY,
  "event_type" VARCHAR(100) NOT NULL,
  "processed_at" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "stripe_webhook_events_processed_at_idx" ON "stripe_webhook_events" ("processed_at");
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
CREATE UNIQUE INDEX IF NOT EXISTS "snapshots_one_current_per_project" ON "build_snapshots" ("project_id") WHERE "is_current" = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS "snapshots_project_version_unique" ON "build_snapshots" ("project_id", "version");
CREATE INDEX IF NOT EXISTS "snapshots_project_version_idx" ON "build_snapshots" ("project_id", "version");
CREATE INDEX IF NOT EXISTS "snapshots_current_idx" ON "build_snapshots" ("is_current");
CREATE INDEX IF NOT EXISTS "snapshots_project_idx" ON "build_snapshots" ("project_id");
CREATE UNIQUE INDEX IF NOT EXISTS "recovery_checkpoint_project_artifact_source_unique" ON "recovery_checkpoints" ("project_id", "artifact_version", "source");
CREATE INDEX IF NOT EXISTS "recovery_checkpoint_project_idx" ON "recovery_checkpoints" ("project_id", "created_at");
CREATE INDEX IF NOT EXISTS "recovery_checkpoint_snapshot_idx" ON "recovery_checkpoints" ("snapshot_id");
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

CREATE TABLE IF NOT EXISTS "project_messages" (
  "id" SERIAL PRIMARY KEY,
  "project_id" INTEGER NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" VARCHAR(20) NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "project_messages_project_idx" ON "project_messages" ("project_id");
CREATE INDEX IF NOT EXISTS "project_messages_created_idx" ON "project_messages" ("project_id", "created_at");

CREATE TABLE IF NOT EXISTS "build_events" (
  "id" SERIAL PRIMARY KEY,
  "project_id" INTEGER NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "event" VARCHAR(50) NOT NULL,
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "build_events_project_idx" ON "build_events" ("project_id");
CREATE INDEX IF NOT EXISTS "build_events_project_id_idx" ON "build_events" ("project_id", "id");

CREATE TABLE IF NOT EXISTS "project_assets" (
  "id" SERIAL PRIMARY KEY,
  "project_id" INTEGER NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "filename" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(100),
  "content" TEXT NOT NULL,
  "created_at" TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "project_assets_project_idx" ON "project_assets" ("project_id");

CREATE TABLE IF NOT EXISTS "user_build_stats" (
  "user_id" INTEGER PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "total_builds" INTEGER NOT NULL DEFAULT 0,
  "successful_builds" INTEGER NOT NULL DEFAULT 0,
  "failed_builds" INTEGER NOT NULL DEFAULT 0,
  "total_credits_spent" INTEGER NOT NULL DEFAULT 0,
  "total_deploys" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP DEFAULT NOW()
);

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "locale" VARCHAR(10) DEFAULT 'en';
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "build_capabilities" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "product_contract" JSONB;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "research_record" JSONB;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "product_plan" JSONB;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "agent_coordination" JSONB;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "requirement_manifest" JSONB;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "working_artifact_version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "working_artifact_integrity" JSONB;
ALTER TABLE "build_snapshots" ADD COLUMN IF NOT EXISTS "requirement_manifest" JSONB;
ALTER TABLE "build_snapshots" ADD COLUMN IF NOT EXISTS "artifact_integrity" JSONB;
ALTER TABLE "build_snapshots" ALTER COLUMN "is_current" SET DEFAULT FALSE;
WITH ranked_current AS (
  SELECT "id",
         ROW_NUMBER() OVER (
           PARTITION BY "project_id"
           ORDER BY "version" DESC, "created_at" DESC, "id" DESC
         ) AS rn
  FROM "build_snapshots"
  WHERE "is_current" = TRUE
)
UPDATE "build_snapshots" b
SET "is_current" = FALSE
FROM ranked_current r
WHERE b."id" = r."id" AND r.rn > 1;

CREATE TABLE IF NOT EXISTS "organizations" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(120) NOT NULL,
  "slug" VARCHAR(48) NOT NULL UNIQUE,
  "owner_user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "sso_enabled" BOOLEAN DEFAULT FALSE,
  "sso_provider" VARCHAR(20),
  "sso_entity_id" VARCHAR(500),
  "sso_metadata_url" TEXT,
  "sso_client_id" VARCHAR(255),
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "organizations_slug_idx" ON "organizations" ("slug");

CREATE TABLE IF NOT EXISTS "organization_members" (
  "id" SERIAL PRIMARY KEY,
  "organization_id" INTEGER NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" VARCHAR(20) NOT NULL DEFAULT 'member',
  "created_at" TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "org_members_org_idx" ON "organization_members" ("organization_id");
CREATE INDEX IF NOT EXISTS "org_members_user_idx" ON "organization_members" ("user_id");

CREATE TABLE IF NOT EXISTS "organization_domains" (
  "id" SERIAL PRIMARY KEY,
  "organization_id" INTEGER NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "domain" VARCHAR(255) NOT NULL UNIQUE,
  "verified" BOOLEAN DEFAULT FALSE,
  "created_at" TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "org_domains_org_idx" ON "organization_domains" ("organization_id");
`;

const SECTION18_INTEGRITY_SQL = `
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "subscriptions" WHERE "user_id" IS NULL) THEN
    RAISE EXCEPTION 'Section 18 migration blocked: subscriptions contains rows without user_id';
  END IF;
  IF EXISTS (SELECT 1 FROM "github_connections" WHERE "user_id" IS NULL) THEN
    RAISE EXCEPTION 'Section 18 migration blocked: github_connections contains rows without user_id';
  END IF;
  IF EXISTS (SELECT 1 FROM "user_credits" WHERE "user_id" IS NULL) THEN
    RAISE EXCEPTION 'Section 18 migration blocked: user_credits contains rows without user_id';
  END IF;
  IF EXISTS (SELECT 1 FROM "credit_transactions" WHERE "user_id" IS NULL) THEN
    RAISE EXCEPTION 'Section 18 migration blocked: credit_transactions contains rows without user_id';
  END IF;
  IF EXISTS (SELECT 1 FROM "projects" WHERE "user_id" IS NULL) THEN
    RAISE EXCEPTION 'Section 18 migration blocked: projects contains rows without user_id';
  END IF;
  IF EXISTS (SELECT 1 FROM "agent_logs" WHERE "project_id" IS NULL) THEN
    RAISE EXCEPTION 'Section 18 migration blocked: agent_logs contains rows without project_id';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "cosine_improvements"
    WHERE "project_id" IS NULL OR "user_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Section 18 migration blocked: cosine_improvements contains orphan ownership';
  END IF;
  IF EXISTS (SELECT 1 FROM "cosine_connections" WHERE "user_id" IS NULL) THEN
    RAISE EXCEPTION 'Section 18 migration blocked: cosine_connections contains rows without user_id';
  END IF;
  IF EXISTS (
    SELECT "stripe_customer_id"
    FROM "subscriptions"
    WHERE "stripe_customer_id" IS NOT NULL
    GROUP BY "stripe_customer_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Section 18 migration blocked: duplicate Stripe customer IDs require reconciliation';
  END IF;
  IF EXISTS (
    SELECT "stripe_subscription_id"
    FROM "subscriptions"
    WHERE "stripe_subscription_id" IS NOT NULL
    GROUP BY "stripe_subscription_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Section 18 migration blocked: duplicate Stripe subscription IDs require reconciliation';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM "credit_transactions" c
    LEFT JOIN "projects" p ON p."id" = c."project_id"
    WHERE c."project_id" IS NOT NULL AND p."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Section 18 migration blocked: credit_transactions contains unknown project_id values';
  END IF;
END $$;

ALTER TABLE "subscriptions" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "github_connections" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "user_credits" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "credit_transactions" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "agent_logs" ALTER COLUMN "project_id" SET NOT NULL;
ALTER TABLE "cosine_improvements" ALTER COLUMN "project_id" SET NOT NULL;
ALTER TABLE "cosine_improvements" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "cosine_connections" ALTER COLUMN "user_id" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_stripe_customer_unique"
  ON "subscriptions" ("stripe_customer_id")
  WHERE "stripe_customer_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_stripe_subscription_unique"
  ON "subscriptions" ("stripe_subscription_id")
  WHERE "stripe_subscription_id" IS NOT NULL;

DO $$
BEGIN
  ALTER TABLE "credit_transactions"
    ADD CONSTRAINT "credit_transactions_project_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
`;

const SECTION25_BUILD_STATUS_SQL = `
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "prompt_intent" JSONB;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "build_stage" VARCHAR(50) DEFAULT 'planning';
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "failure_stage" VARCHAR(50);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "output_maturity" VARCHAR(32) DEFAULT 'structural';
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "plan_status" VARCHAR(32) DEFAULT 'planning';
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "plan_revision_request" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "monetization_approved" BOOLEAN DEFAULT FALSE;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "integrations_approved" BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS "projects_build_stage_idx" ON "projects" ("build_stage");
CREATE INDEX IF NOT EXISTS "projects_failure_stage_idx" ON "projects" ("failure_stage");
`;

const SECTION26_EVIDENCE_AUDIT_SQL = `
CREATE TABLE IF NOT EXISTS "project_evidence" (
  "id" SERIAL PRIMARY KEY,
  "project_id" INTEGER NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "kind" VARCHAR(64) NOT NULL,
  "build_stage" VARCHAR(50),
  "attempt" INTEGER,
  "artifact_version" INTEGER,
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "project_evidence_project_id_idx"
  ON "project_evidence" ("project_id", "id");
CREATE INDEX IF NOT EXISTS "project_evidence_project_kind_idx"
  ON "project_evidence" ("project_id", "kind");
CREATE INDEX IF NOT EXISTS "project_evidence_project_artifact_idx"
  ON "project_evidence" ("project_id", "artifact_version");

INSERT INTO "project_evidence"
  ("project_id", "user_id", "kind", "build_stage", "artifact_version", "payload", "created_at")
SELECT
  p."id",
  p."user_id",
  'intake',
  p."build_stage",
  p."working_artifact_version",
  jsonb_build_object(
    'originalPrompt', COALESCE(p."product_contract"->>'originalPrompt', p."description"),
    'productContract', p."product_contract",
    'selectedStack', p."tech_stack",
    'promptIntent', p."prompt_intent",
    'backfilled', true
  ),
  COALESCE(p."created_at", NOW())
FROM "projects" p
WHERE NOT EXISTS (
  SELECT 1
  FROM "project_evidence" e
  WHERE e."project_id" = p."id" AND e."kind" = 'intake'
);
`;

type AppForgeSchemaMigration = {
  version: string;
  name: string;
  sql: string;
};

const APPFORGE_SCHEMA_MIGRATIONS: readonly AppForgeSchemaMigration[] = [
  {
    version: "20260703_001",
    name: "baseline_appforge_schema",
    sql: SCHEMA_SQL,
  },
  {
    version: "20260916_002",
    name: "appforge_schema_patch",
    sql: SCHEMA_PATCH_SQL,
  },
  {
    version: "20260927_003",
    name: "section18_integrity_constraints",
    sql: SECTION18_INTEGRITY_SQL,
  },
  {
    version: "20260929_004",
    name: "section25_build_status_and_approvals",
    sql: SECTION25_BUILD_STATUS_SQL,
  },
  {
    version: "20260929_005",
    name: "section26_evidence_audit_trail",
    sql: SECTION26_EVIDENCE_AUDIT_SQL,
  },
];

function migrationChecksum(migrationSql: string): string {
  return createHash("sha256").update(migrationSql, "utf8").digest("hex");
}

async function applyAppForgeSchemaMigrations(sql: postgres.Sql): Promise<void> {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS "appforge_schema_migrations" (
      "version" VARCHAR(64) PRIMARY KEY,
      "name" VARCHAR(255) NOT NULL,
      "checksum" VARCHAR(64) NOT NULL,
      "applied_at" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await sql.unsafe(
    "SELECT pg_advisory_lock(hashtext('appforge_schema_migrations_v1'))",
  );

  try {
    for (const migration of APPFORGE_SCHEMA_MIGRATIONS) {
      const checksum = migrationChecksum(migration.sql);
      const existing = await sql`
        SELECT "checksum", "name"
        FROM "appforge_schema_migrations"
        WHERE "version" = ${migration.version}
      `;
      const appliedChecksum = existing[0]?.checksum as string | undefined;
      if (appliedChecksum) {
        if (appliedChecksum !== checksum) {
          throw new Error(
            `Applied database migration ${migration.version} checksum changed; create a new migration instead of editing history`,
          );
        }
        continue;
      }

      await sql.begin(async (tx) => {
        await tx.unsafe(migration.sql);
        await tx`
          INSERT INTO "appforge_schema_migrations"
            ("version", "name", "checksum", "applied_at")
          VALUES
            (${migration.version}, ${migration.name}, ${checksum}, NOW())
        `;
      });
      console.log(
        `Applied AppForge migration ${migration.version} (${migration.name})`,
      );
    }
  } finally {
    await sql
      .unsafe(
        "SELECT pg_advisory_unlock(hashtext('appforge_schema_migrations_v1'))",
      )
      .catch(() => undefined);
  }
}

export async function ensureAppSchema(): Promise<void> {
  if (!ENV.databaseUrl) {
    if (ENV.isProduction) {
      throw new Error("DATABASE_URL is required in production");
    }
    console.warn("Skipping schema ensure: DATABASE_URL is not set");
    return;
  }
  const sql = postgres(ENV.databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 5,
  });
  try {
    await applyAppForgeSchemaMigrations(sql);
    await upsertEncryptedOwner(sql);
    console.log("AppForge schema migrations complete");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function upsertEncryptedOwner(sql: postgres.Sql): Promise<void> {
  const {
    canonicalOwnerEmail,
    encryptOwnerEmail,
    ownerEmailHmac,
    isOwnerEmail,
  } = await import("../lib/serverSecrets.js");
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
