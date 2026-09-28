/** Schema patch migration 20260916_002. */
export const SCHEMA_PATCH_SQL = `
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
