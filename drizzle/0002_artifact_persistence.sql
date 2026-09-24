-- AppForge #13 Artifact Persistence
ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "working_artifact_version" integer NOT NULL DEFAULT 0;
ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "working_artifact_integrity" jsonb;
ALTER TABLE "build_snapshots"
  ADD COLUMN IF NOT EXISTS "artifact_integrity" jsonb;
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
CREATE UNIQUE INDEX IF NOT EXISTS "snapshots_one_current_per_project"
  ON "build_snapshots" ("project_id") WHERE "is_current" = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS "snapshots_project_version_unique"
  ON "build_snapshots" ("project_id", "version");
