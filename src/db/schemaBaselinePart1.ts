/** First half of immutable baseline SCHEMA_SQL. */
export const SCHEMA_SQL_PART1 = `
CREATE TABLE IF NOT EXISTS "users" (
  "id" SERIAL PRIMARY KEY,
  "open_id" VARCHAR(255) UNIQUE,
  "email" VARCHAR(255) UNIQUE,
  "name" VARCHAR(255),
  "picture" TEXT,
  "is_banned" BOOLEAN DEFAULT FALSE,
  "banned_at" TIMESTAMP,
  "ban_reason" TEXT,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "stripe_customer_id" VARCHAR(255),
  "stripe_subscription_id" VARCHAR(255),
  "status" VARCHAR(50),
  "tier" VARCHAR(50) DEFAULT 'free',
  "trial_end" TIMESTAMP,
  "current_period_end" TIMESTAMP,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "github_connections" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "github_username" VARCHAR(255),
  "access_token" TEXT,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "user_credits" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "balance" INTEGER NOT NULL DEFAULT 0,
  "tier" VARCHAR(50) DEFAULT 'free',
  "monthly_allowance" INTEGER DEFAULT 0,
  "last_refill_at" TIMESTAMP DEFAULT NOW(),
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "credit_transactions" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER REFERENCES "users"("id") ON DELETE CASCADE,
  "amount" INTEGER NOT NULL,
  "type" VARCHAR(50) NOT NULL,
  "project_id" INTEGER,
  "stripe_payment_intent_id" VARCHAR(255),
  "description" TEXT,
  "created_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "projects" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER REFERENCES "users"("id") ON DELETE CASCADE,
  "title" VARCHAR(255),
  "description" TEXT,
  "tech_stack" VARCHAR(255) DEFAULT 'react-node',
  "status" VARCHAR(50) DEFAULT 'pending',
  "error_message" TEXT,
  "pause_reason" TEXT,
  "generated_files" JSONB,
  "working_artifact_version" INTEGER NOT NULL DEFAULT 0,
  "working_artifact_integrity" JSONB,
  "credits_spent" INTEGER DEFAULT 0,
  "credits_reserved" INTEGER DEFAULT 0,
  "product_contract" JSONB,
  "research_record" JSONB,
  "product_plan" JSONB,
  "agent_coordination" JSONB,
  "requirement_manifest" JSONB,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "agent_logs" (
  "id" SERIAL PRIMARY KEY,
  "project_id" INTEGER REFERENCES "projects"("id") ON DELETE CASCADE,
  "agent" VARCHAR(50),
  "content" TEXT,
  "credits_charged" INTEGER DEFAULT 0,
  "is_complete" BOOLEAN DEFAULT FALSE,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "cosine_improvements" (
  "id" SERIAL PRIMARY KEY,
  "project_id" INTEGER REFERENCES "projects"("id") ON DELETE CASCADE,
  "user_id" INTEGER REFERENCES "users"("id") ON DELETE CASCADE,
  "improvements" JSONB,
  "pr_url" TEXT,
  "status" VARCHAR(50) DEFAULT 'pending',
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "user_strikes" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "strike_number" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "content_snapshot" TEXT,
  "created_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "moderation_flags" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "project_id" INTEGER REFERENCES "projects"("id") ON DELETE CASCADE,
  "flagged_text" TEXT NOT NULL,
  "category" VARCHAR(50) NOT NULL,
  "auto_flagged" BOOLEAN DEFAULT TRUE,
  "admin_reviewed" BOOLEAN DEFAULT FALSE,
  "admin_action" VARCHAR(50),
  "created_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "god_codes" (
  "id" SERIAL PRIMARY KEY,
  "code_hash" VARCHAR(255) UNIQUE NOT NULL,
  "tier" VARCHAR(50) NOT NULL,
  "credits" INTEGER DEFAULT 0,
  "trial_days" INTEGER DEFAULT 0,
  "is_used" BOOLEAN DEFAULT FALSE,
  "used_by_user_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "used_at" TIMESTAMP,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "sms_verifications" (
  "id" SERIAL PRIMARY KEY,
  "code_id" INTEGER NOT NULL REFERENCES "god_codes"("id") ON DELETE CASCADE,
  "phone_number" VARCHAR(50) NOT NULL,
  "otp_hash" VARCHAR(255) NOT NULL,
  "expires_at" TIMESTAMP NOT NULL,
  "verified_at" TIMESTAMP,
  "created_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "compliance_records" (
  "id" SERIAL PRIMARY KEY,
  "record_type" VARCHAR(50) NOT NULL,
  "user_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "details" JSONB,
  "admin_email" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "user_sessions" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "ip_address" VARCHAR(50),
  "user_agent" TEXT,
  "country" VARCHAR(100),
  "created_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "cosine_connections" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "access_token" TEXT,
  "refresh_token" TEXT,
  "expires_at" TIMESTAMP,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);`;
