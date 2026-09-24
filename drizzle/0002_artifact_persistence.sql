-- AppForge #13 Artifact Persistence
ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "working_artifact_version" integer NOT NULL DEFAULT 0;
ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "working_artifact_integrity" jsonb;
ALTER TABLE "build_snapshots"
  ADD COLUMN IF NOT EXISTS "artifact_integrity" jsonb;
UPDATE "build_snapshots" SET "is_current" = FALSE WHERE "is_current" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "snapshots_project_version_unique"
  ON "build_snapshots" ("project_id","version");
CREATE UNIQUE INDEX IF NOT EXISTS "snapshots_one_current_per_project"
  ON "build_snapshots" ("project_id") WHERE "is_current" = TRUE;
