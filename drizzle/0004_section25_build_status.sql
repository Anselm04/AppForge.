ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "build_stage" VARCHAR(50) DEFAULT 'planning';
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "failure_stage" VARCHAR(50);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "output_maturity" VARCHAR(32) DEFAULT 'structural';
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "plan_status" VARCHAR(32) DEFAULT 'planning';
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "plan_revision_request" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "monetization_approved" BOOLEAN DEFAULT FALSE;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "integrations_approved" BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS "projects_build_stage_idx" ON "projects" ("build_stage");
CREATE INDEX IF NOT EXISTS "projects_failure_stage_idx" ON "projects" ("failure_stage");
