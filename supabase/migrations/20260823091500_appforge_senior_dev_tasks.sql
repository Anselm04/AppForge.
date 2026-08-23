-- Senior Dev Agent task tracking
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

CREATE INDEX IF NOT EXISTS "senior_dev_tasks_project_idx" ON "senior_dev_tasks"("project_id");
CREATE INDEX IF NOT EXISTS "senior_dev_tasks_user_idx" ON "senior_dev_tasks"("user_id");
CREATE INDEX IF NOT EXISTS "senior_dev_tasks_status_idx" ON "senior_dev_tasks"("status");

-- Build snapshots for atomic rollback
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
  "is_current" BOOLEAN DEFAULT TRUE,
  "created_at" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "snapshots_project_version_idx" ON "build_snapshots"("project_id", "version");
CREATE INDEX IF NOT EXISTS "snapshots_current_idx" ON "build_snapshots"("is_current");
CREATE INDEX IF NOT EXISTS "snapshots_project_idx" ON "build_snapshots"("project_id");

-- Prevent negative credit balances at database level (extra safety beyond app-level checks)
DO $$ BEGIN
  ALTER TABLE "user_credits" ADD CONSTRAINT "user_credits_balance_nonneg" CHECK ("balance" >= 0);
EXCEPTION WHEN duplicate_object THEN null;
END $$;