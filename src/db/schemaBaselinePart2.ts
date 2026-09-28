/** Second half of immutable baseline SCHEMA_SQL. */
export const SCHEMA_SQL_PART2 = `

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
