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
