-- Section 24: durable recovery checkpoints for validated/deployed artifacts.

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

CREATE UNIQUE INDEX IF NOT EXISTS "recovery_checkpoint_project_artifact_source_unique"
  ON "recovery_checkpoints" ("project_id", "artifact_version", "source");
CREATE INDEX IF NOT EXISTS "recovery_checkpoint_project_idx"
  ON "recovery_checkpoints" ("project_id", "created_at");
CREATE INDEX IF NOT EXISTS "recovery_checkpoint_snapshot_idx"
  ON "recovery_checkpoints" ("snapshot_id");
