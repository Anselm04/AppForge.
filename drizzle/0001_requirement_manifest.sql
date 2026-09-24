-- AppForge #11 Requirements System persistence
-- Safe additive migration for existing deployments.

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "requirement_manifest" jsonb;

ALTER TABLE "build_snapshots"
  ADD COLUMN IF NOT EXISTS "requirement_manifest" jsonb;
