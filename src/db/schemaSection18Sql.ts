/** Section 18 integrity migration 20260927_003. */
export const SECTION18_INTEGRITY_SQL = `
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "subscriptions" WHERE "user_id" IS NULL) THEN
    RAISE EXCEPTION 'Section 18 migration blocked: subscriptions contains rows without user_id';
  END IF;
  IF EXISTS (SELECT 1 FROM "github_connections" WHERE "user_id" IS NULL) THEN
    RAISE EXCEPTION 'Section 18 migration blocked: github_connections contains rows without user_id';
  END IF;
  IF EXISTS (SELECT 1 FROM "user_credits" WHERE "user_id" IS NULL) THEN
    RAISE EXCEPTION 'Section 18 migration blocked: user_credits contains rows without user_id';
  END IF;
  IF EXISTS (SELECT 1 FROM "credit_transactions" WHERE "user_id" IS NULL) THEN
    RAISE EXCEPTION 'Section 18 migration blocked: credit_transactions contains rows without user_id';
  END IF;
  IF EXISTS (SELECT 1 FROM "projects" WHERE "user_id" IS NULL) THEN
    RAISE EXCEPTION 'Section 18 migration blocked: projects contains rows without user_id';
  END IF;
  IF EXISTS (SELECT 1 FROM "agent_logs" WHERE "project_id" IS NULL) THEN
    RAISE EXCEPTION 'Section 18 migration blocked: agent_logs contains rows without project_id';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "cosine_improvements"
    WHERE "project_id" IS NULL OR "user_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Section 18 migration blocked: cosine_improvements contains orphan ownership';
  END IF;
  IF EXISTS (SELECT 1 FROM "cosine_connections" WHERE "user_id" IS NULL) THEN
    RAISE EXCEPTION 'Section 18 migration blocked: cosine_connections contains rows without user_id';
  END IF;
  IF EXISTS (
    SELECT "stripe_customer_id"
    FROM "subscriptions"
    WHERE "stripe_customer_id" IS NOT NULL
    GROUP BY "stripe_customer_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Section 18 migration blocked: duplicate Stripe customer IDs require reconciliation';
  END IF;
  IF EXISTS (
    SELECT "stripe_subscription_id"
    FROM "subscriptions"
    WHERE "stripe_subscription_id" IS NOT NULL
    GROUP BY "stripe_subscription_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Section 18 migration blocked: duplicate Stripe subscription IDs require reconciliation';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM "credit_transactions" c
    LEFT JOIN "projects" p ON p."id" = c."project_id"
    WHERE c."project_id" IS NOT NULL AND p."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Section 18 migration blocked: credit_transactions contains unknown project_id values';
  END IF;
END $$;

ALTER TABLE "subscriptions" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "github_connections" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "user_credits" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "credit_transactions" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "agent_logs" ALTER COLUMN "project_id" SET NOT NULL;
ALTER TABLE "cosine_improvements" ALTER COLUMN "project_id" SET NOT NULL;
ALTER TABLE "cosine_improvements" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "cosine_connections" ALTER COLUMN "user_id" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_stripe_customer_unique"
  ON "subscriptions" ("stripe_customer_id")
  WHERE "stripe_customer_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_stripe_subscription_unique"
  ON "subscriptions" ("stripe_subscription_id")
  WHERE "stripe_subscription_id" IS NOT NULL;

DO $$
BEGIN
  ALTER TABLE "credit_transactions"
    ADD CONSTRAINT "credit_transactions_project_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
`;
