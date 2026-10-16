CREATE TABLE IF NOT EXISTS "project_change_contracts" (
  "id" SERIAL PRIMARY KEY,
  "project_id" INTEGER NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "user_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "base_product_contract_hash" VARCHAR(64) NOT NULL,
  "contract" JSONB NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'proposed',
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "applied_at" TIMESTAMP,
  CONSTRAINT "project_change_contracts_status_check"
    CHECK ("status" IN ('proposed', 'validated', 'applied', 'rejected', 'rolled-forward'))
);
CREATE INDEX IF NOT EXISTS "project_change_contracts_project_created_idx"
  ON "project_change_contracts" ("project_id", "created_at");

CREATE TABLE IF NOT EXISTS "product_version_records" (
  "id" SERIAL PRIMARY KEY,
  "project_id" INTEGER NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "artifact_version" INTEGER NOT NULL,
  "artifact_sha256" VARCHAR(64) NOT NULL,
  "database_version" VARCHAR(128),
  "provider_config_version" VARCHAR(128),
  "webhook_version" VARCHAR(128),
  "job_version" VARCHAR(128),
  "flag_snapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "resource_versions" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "recovery_checkpoint_id" INTEGER,
  "evidence_state" VARCHAR(32) NOT NULL DEFAULT 'structural',
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE ("project_id", "artifact_version")
);
CREATE INDEX IF NOT EXISTS "product_version_records_project_idx"
  ON "product_version_records" ("project_id", "artifact_version");

CREATE TABLE IF NOT EXISTS "support_cases" (
  "id" SERIAL PRIMARY KEY,
  "case_ref" VARCHAR(40) UNIQUE NOT NULL,
  "user_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "project_id" INTEGER REFERENCES "projects"("id") ON DELETE SET NULL,
  "build_ref" VARCHAR(128),
  "severity" VARCHAR(16) NOT NULL,
  "category" VARCHAR(80) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'open',
  "customer_summary" TEXT NOT NULL,
  "internal_notes" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "log_refs" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "billing_adjustment" JSONB,
  "resolution" TEXT,
  "root_cause" TEXT,
  "prevention" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "resolved_at" TIMESTAMP,
  CONSTRAINT "support_cases_severity_check" CHECK ("severity" IN ('SEV-1','SEV-2','SEV-3','SEV-4')),
  CONSTRAINT "support_cases_status_check" CHECK ("status" IN ('open','investigating','waiting-customer','resolved','closed'))
);
CREATE INDEX IF NOT EXISTS "support_cases_user_created_idx" ON "support_cases" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "support_cases_status_severity_idx" ON "support_cases" ("status", "severity");

CREATE TABLE IF NOT EXISTS "credit_settlements" (
  "id" SERIAL PRIMARY KEY,
  "idempotency_key" VARCHAR(255) UNIQUE NOT NULL,
  "user_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "project_id" INTEGER REFERENCES "projects"("id") ON DELETE SET NULL,
  "build_ref" VARCHAR(128),
  "failure_kind" VARCHAR(64) NOT NULL,
  "outcome" VARCHAR(32) NOT NULL,
  "amount" INTEGER NOT NULL DEFAULT 0,
  "reason" TEXT NOT NULL,
  "customer_fault" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "credit_settlements_amount_nonnegative" CHECK ("amount" >= 0)
);
CREATE INDEX IF NOT EXISTS "credit_settlements_user_created_idx" ON "credit_settlements" ("user_id", "created_at");

CREATE TABLE IF NOT EXISTS "incidents" (
  "id" SERIAL PRIMARY KEY,
  "incident_ref" VARCHAR(40) UNIQUE NOT NULL,
  "severity" VARCHAR(16) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'detected',
  "summary" TEXT NOT NULL,
  "affected_services" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "customer_impact" TEXT,
  "evidence_refs" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "containment" TEXT,
  "recovery" TEXT,
  "communications" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "root_cause" TEXT,
  "corrective_actions" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "regression_evidence" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "resolved_at" TIMESTAMP,
  CONSTRAINT "incidents_severity_check" CHECK ("severity" IN ('SEV-1','SEV-2','SEV-3','SEV-4')),
  CONSTRAINT "incidents_status_check" CHECK ("status" IN ('detected','triaging','contained','recovering','monitoring','resolved'))
);
CREATE INDEX IF NOT EXISTS "incidents_status_severity_idx" ON "incidents" ("status", "severity");
