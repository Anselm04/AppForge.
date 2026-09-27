import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const ensureSchema = source("src/db/ensureSchema.ts");
const drizzleSchema = source("src/db/schema.ts");
const databaseAgent = source("src/agents/databaseAgent.ts");
const backup = source("scripts/backup-database.sh");
const backupVerify = source("scripts/backup-verify.sh");
const restore = source("scripts/backup-restore.sh");
const sandbox = source("src/services/projectSandbox.ts");
const isolatedBuild = source("src/services/isolatedBuildRunner.ts");
const deployer = source("src/services/deployer.ts");
const sourceOfTruth = source("docs/SOURCE_OF_TRUTH.md");
const disasterRecovery = source("docs/DISASTER_RECOVERY.md");

describe("Section 18 AppForge database and persistence boundaries", () => {
  it("uses one locked, transactional, checksummed production migration chain", () => {
    expect(ensureSchema).toContain(
      'CREATE TABLE IF NOT EXISTS "appforge_schema_migrations"',
    );
    expect(ensureSchema).toContain("APPFORGE_SCHEMA_MIGRATIONS");
    expect(ensureSchema).toContain("pg_advisory_lock");
    expect(ensureSchema).toContain("await sql.begin(async (tx)");
    expect(ensureSchema).toContain("migrationChecksum");
    expect(ensureSchema).toContain(
      "checksum changed; create a new migration instead of editing history",
    );
    expect(ensureSchema).toContain("section18_integrity_constraints");

    expect(sourceOfTruth).toContain(
      "the only production migration executor is the immutable",
    );
    expect(sourceOfTruth).toContain(
      "Neither directory is a second production migration engine",
    );
  });

  it("fails integrity migration before guessing or deleting orphan ownership data", () => {
    for (const finding of [
      "subscriptions contains rows without user_id",
      "github_connections contains rows without user_id",
      "user_credits contains rows without user_id",
      "credit_transactions contains rows without user_id",
      "projects contains rows without user_id",
      "agent_logs contains rows without project_id",
      "cosine_improvements contains orphan ownership",
      "cosine_connections contains rows without user_id",
      "duplicate Stripe customer IDs require reconciliation",
      "duplicate Stripe subscription IDs require reconciliation",
      "credit_transactions contains unknown project_id values",
    ]) {
      expect(ensureSchema).toContain(finding);
    }

    expect(ensureSchema).toContain(
      'ALTER TABLE "subscriptions" ALTER COLUMN "user_id" SET NOT NULL',
    );
    expect(ensureSchema).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_stripe_customer_unique"',
    );
    expect(ensureSchema).toContain(
      'ADD CONSTRAINT "credit_transactions_project_fk"',
    );
  });

  it("keeps the Drizzle application model aligned with mandatory ownership and billing identity invariants", () => {
    expect(drizzleSchema).toMatch(
      /subscriptions[\s\S]*userId:[\s\S]*\.notNull\(\)[\s\S]*\.unique\(\)/,
    );
    expect(drizzleSchema).toMatch(/stripeCustomerId:[^\n]*\.unique\(\)/);
    expect(drizzleSchema).toMatch(/stripeSubscriptionId:[\s\S]*?\.unique\(\)/);
    expect(drizzleSchema).toMatch(
      /creditTransactions[\s\S]*userId:[\s\S]*\.notNull\(\)/,
    );
    expect(drizzleSchema).toMatch(/projects[\s\S]*userId:[\s\S]*\.notNull\(\)/);
    expect(drizzleSchema).toMatch(
      /agentLogs[\s\S]*projectId:[\s\S]*\.notNull\(\)/,
    );
  });

  it("creates checksummed backups and proves restore plus migration compatibility", () => {
    expect(backup).toContain("DATABASE_URL=");
    expect(backup).not.toContain("postgresql://postgres:password@localhost");
    expect(backup).toMatch(/sha256sum|shasum/);
    expect(backup).toContain("--no-owner --no-privileges");

    expect(backupVerify).toContain("Backup checksum missing");
    expect(backupVerify).toContain("CREATE DATABASE");
    expect(backupVerify).toContain("-v ON_ERROR_STOP=1");
    expect(backupVerify).toContain("npm run db:migrate");
    expect(backupVerify).toContain("appforge_schema_migrations");

    expect(restore).toContain("Backup checksum missing");
    expect(restore).toContain("separate database named");
    expect(restore).toContain("-v ON_ERROR_STOP=1");
    expect(restore).toContain("npm run db:migrate");
  });

  it("documents database migration and restore recovery as a release boundary", () => {
    expect(disasterRecovery).toContain(
      "## Database migration and persistence recovery",
    );
    expect(disasterRecovery).toContain("advisory lock");
    expect(disasterRecovery).toContain("SHA-256 checksum");
    expect(disasterRecovery).toContain(
      "Orphans, duplicate external billing IDs, or broken foreign-key targets block migration",
    );
    expect(disasterRecovery).toContain(
      "restore the newest verified backup into a separate restore database",
    );
  });

  it("does not pass AppForge host database credentials into generated products", () => {
    const keepStart = sandbox.indexOf("const keep = [");
    const keepEnd = sandbox.indexOf("] as const;", keepStart);
    const sandboxWhitelist = sandbox.slice(keepStart, keepEnd);
    expect(sandboxWhitelist).not.toContain("DATABASE_URL");
    expect(sandboxWhitelist).not.toContain("SUPABASE_SERVICE_ROLE_KEY");

    expect(isolatedBuild).toContain("noHostCredentials: true");

    const flyEnvStart = deployer.indexOf("const safeEnv = {");
    const flyEnvEnd = deployer.indexOf("};", flyEnvStart);
    const flyEnv = deployer.slice(flyEnvStart, flyEnvEnd);
    expect(flyEnv).toContain("FLY_API_TOKEN");
    expect(flyEnv).not.toContain("DATABASE_URL");
    expect(flyEnv).not.toContain("SUPABASE");
  });

  it("keeps the standalone database agent contract-derived instead of inventing generic tables", () => {
    expect(databaseAgent).toContain('source: "canonical product contract"');
    expect(databaseAgent).toContain("dataModels");
    expect(databaseAgent).toContain("versioned migration");
    expect(databaseAgent).toContain(
      "server-side persistence/repository implementation",
    );
    expect(databaseAgent).toContain(
      "never reuse AppForge production database credentials or internal tables",
    );
    expect(databaseAgent).not.toContain("users 1:N entities");
    expect(databaseAgent).not.toContain("audit_logs");
  });
});
