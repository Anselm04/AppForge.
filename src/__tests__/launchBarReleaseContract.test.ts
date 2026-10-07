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
    const adminMfa = source(".github/workflows/production-admin-mfa.yml");
    const databaseRecovery = source(
      ".github/workflows/production-database-recovery.yml",
    );
    const gate = source(".github/workflows/launch-bar-certification.yml");
    const adminRouter = source("src/routers/admin.ts");
    const dockerfile = source("Dockerfile");
    const deploy = source(".github/workflows/deploy-production.yml");

    expect(journey).toContain("name: Production Full Customer Journey");
    expect(journey).toContain("Run the real production customer journey");

    expect(auth).toContain("name: Production Auth Lifecycle");
    expect(auth).toContain("/gate1-auth full ");
    expect(auth).not.toContain(
      "request-confirmation\n          - complete-lifecycle",
    );
    expect(auth).toContain("ten logout/relogin boundaries");

    expect(adminMfa).toContain("name: Production Admin MFA");
    expect(adminMfa).toContain("DATABASE_URL");
    expect(adminMfa).toContain("admin_mfa_verify");
    expect(adminMfa).toContain("approved");
    expect(adminMfa).toContain("APPFORGE_RELEASE_SHA");
    expect(adminRouter).toContain(
      "releaseSha: process.env.APPFORGE_RELEASE_SHA",
    );
    expect(dockerfile).toContain("ARG APPFORGE_RELEASE_SHA");
    expect(dockerfile).toContain(
      "ENV APPFORGE_RELEASE_SHA=$APPFORGE_RELEASE_SHA",
    );
    expect(deploy).toContain("--build-arg APPFORGE_RELEASE_SHA=$RELEASE_SHA");

    expect(databaseRecovery).toContain("name: Production Database Recovery");
    expect(gate).toContain("REQUIRED_CUSTOMER_JOURNEY_PASSES: 3");
    expect(gate).toContain("Production Full Customer Journey");
    expect(gate).toContain("Production Auth Lifecycle");
    expect(gate).toContain("Production Admin MFA");
    expect(gate).toContain("Production Database Recovery");
    expect(gate).toContain("head_sha");
    expect(gate).toContain('conclusion == "success"');
  });
});
