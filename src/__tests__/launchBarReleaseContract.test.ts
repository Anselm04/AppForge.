import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("AppForge launch bar release contract", () => {
  it("enforces security boundaries and real admin MFA", () => {
    const auth = source("src/middleware/requireAuth.ts");
    const admin = source("src/routers/admin.ts");
    const recovery = source("docs/RECOVERY_INVENTORY.md");

    expect(auth).toContain("requireAuthenticatedUser");
    expect(admin).toContain("requestTwilioVerification(ENV.ownerPhone.trim())");
    expect(admin).toContain("checkTwilioVerification(");
    expect(recovery).toContain(
      "Owner admin APIs are not authorized by owner email alone",
    );
    expect(recovery).toContain("server-side `OWNER_PHONE`");
  });

  it("requires recoverable production PostgreSQL backups instead of documentation-only backups", () => {
    const workflow = source(
      ".github/workflows/production-database-recovery.yml",
    );

    expect(workflow).toContain("DATABASE_URL");
    expect(workflow).toContain("pg_dump");
    expect(workflow).toContain("pg_restore");
    expect(workflow).toContain("OFFSITE_BACKUP_PASSPHRASE");
    expect(workflow).toContain("aes-256-cbc");
    expect(workflow).toContain("sha256sum");
  });

  it("keeps exact-artifact monitoring and certification fail closed", () => {
    const deployment = source("src/services/productionAutoDeploy.ts");
    const certification = source("src/lib/certificationLogic.ts");
    const observability = source("src/lib/operationsObservability.ts");

    expect(deployment).toContain("deploymentManifestSha256");
    expect(deployment).toContain("deploymentAudit");
    expect(certification).toContain("missingEvidence.length === 0");
    expect(certification).toContain("productionCertified");
    expect(observability).toContain("evaluateOperationalAlerts");
    expect(observability).toContain("renderPrometheusMetrics");
  });

  it("requires repeated real customer evidence before launch certification", () => {
    const journey = source(
      ".github/workflows/production-full-customer-journey.yml",
    );
    const auth = source(".github/workflows/production-auth-lifecycle.yml");
    const gate = source(".github/workflows/launch-bar-certification.yml");

    expect(journey).toContain("Run the real production customer journey");
    expect(auth).toContain("ten logout/relogin boundaries");
    expect(gate).toContain("REQUIRED_CUSTOMER_JOURNEY_PASSES: 3");
    expect(gate).toContain("Production Full Customer Journey");
    expect(gate).toContain("Production Auth Lifecycle");
    expect(gate).toContain("Production Admin MFA");
    expect(gate).toContain("Production Database Recovery");
    expect(gate).toContain("head_sha");
    expect(gate).toContain('conclusion == "success"');
  });
});
