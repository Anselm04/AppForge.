CREATE TABLE IF NOT EXISTS "account_lifecycle" (
  "user_id" INTEGER PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "language" VARCHAR(32) NOT NULL DEFAULT 'en',
  "communication_preferences" JSONB NOT NULL DEFAULT '{"product":true,"billing":true,"marketing":false}'::jsonb,
  "accessibility_preferences" JSONB NOT NULL DEFAULT '{"reducedMotion":false,"highContrast":false}'::jsonb,
  "deletion_state" VARCHAR(32) NOT NULL DEFAULT 'active',
  "deletion_requested_at" TIMESTAMP,
  "deleted_at" TIMESTAMP,
  "deletion_subject_ref" VARCHAR(64),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "account_lifecycle_deletion_state_check"
    CHECK ("deletion_state" IN ('active', 'pending', 'completed'))
);

CREATE INDEX IF NOT EXISTS "account_lifecycle_deletion_state_idx"
  ON "account_lifecycle" ("deletion_state");

CREATE TABLE IF NOT EXISTS "account_lifecycle_events" (
  "id" SERIAL PRIMARY KEY,
  "subject_ref" VARCHAR(64) NOT NULL,
  "event_type" VARCHAR(64) NOT NULL,
  "details" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "account_lifecycle_events_type_created_idx"
  ON "account_lifecycle_events" ("event_type", "created_at");
