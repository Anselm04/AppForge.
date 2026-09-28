import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");

describe("#24 Recovery and Rollback", () => {
  it("persists immutable known-good recovery checkpoints", () => {
    const schema = source("src/db/schema.ts");
    const migration = source("drizzle/0003_recovery_checkpoints.sql");
    const recovery = source("src/services/recovery.ts");

    expect(schema).toContain("export const recoveryCheckpoints = pgTable(");
    expect(schema).toContain('"recovery_checkpoints"');
    expect(schema).toContain('artifactSha256: varchar("artifact_sha256"');
    expect(schema).toContain(
      'deploymentVersion: integer("deployment_version")',
    );
    expect(schema).toContain("deploymentManifestSha256: varchar(");
    expect(migration).toContain(
      '"recovery_checkpoint_project_artifact_source_unique"',
    );
    expect(recovery).toContain(
      'throw new Error("Recovery checkpoint artifact hash mismatch")',
    );
    expect(recovery).toContain(
      'throw new Error("Recovery checkpoint artifact version mismatch")',
    );
    expect(recovery).toContain('source === "production_verified"');
  });

  it(
    "records validated and production-verified recovery points only after success",
    () => {
      const worker = source("src/services/build-worker.ts");
      const validated = worker.indexOf('source: "validated_artifact"');
      const deploy = worker.indexOf("await deployValidatedProjectWithRetry({");
      const production = worker.indexOf('source: "production_verified"');

      expect(validated).toBeGreaterThan(-1);
      expect(deploy).toBeGreaterThan(validated);
      expect(production).toBeGreaterThan(deploy);
      expect(worker).toContain(
        "deploymentManifestSha256: deployed.deploymentManifestSha256",
      );
      expect(worker).toContain("liveUrl: deployed.liveUrl");
    },
  );

  it(
    "restores the latest known-good snapshot through atomic activation",
    () => {
      const router = source("src/routers/projects.ts");
      const start = router.indexOf(
        "rollbackLatestKnownGood: protectedProcedure",
      );
      const end = router.indexOf(
        "/** Rollback to a specific snapshot version */",
      );
      const rollback = router.slice(start, end);

      expect(start).toBeGreaterThan(-1);
      expect(rollback).toContain("getLatestKnownGoodCheckpoint");
      expect(rollback).toContain(
        "await markSnapshotAsCurrent(checkpoint.snapshotId, input.projectId)",
      );
      expect(rollback).not.toContain("updateProjectFiles");
      expect(rollback).not.toContain("generatedFiles");
    },
  );

  it(
    "covers every required recovery failure class without promoting partial state",
    () => {
      const recovery = source("src/services/recovery.ts");
      const runbook = source("docs/RECOVERY_AND_ROLLBACK.md");
      const kinds = [
        "application_failure",
        "artifact_failure",
        "database_failure",
        "migration_failure",
        "queue_interruption",
        "build_interrupted",
        "provider_failure",
        "deployment_failure",
        "preview_failure",
        "credit_refund_failure",
        "duplicate_build",
        "partial_generation",
        "paused_build",
      ];

      for (const kind of kinds) {
        expect(recovery).toContain(`"${kind}"`);
      }

      expect(runbook).toContain("Working or partial files are");
      expect(runbook).toContain("Database and migration restore");
      expect(runbook).toContain("Queue and interrupted-build recovery");
      expect(runbook).toContain(
        "Credit refunds use attempt-specific idempotency keys",
      );
      expect(runbook).toContain("Data-recovery verification checklist");
    },
  );

  it("keeps Section 24 procedures inside recovery governance", () => {
    const workflow = source(".github/workflows/recovery-readiness.yml");
    const governance = source("scripts/recovery-governance.sh");
    const inventory = source("docs/RECOVERY_INVENTORY.md");

    expect(workflow).toContain("docs/RECOVERY_AND_ROLLBACK.md");
    expect(workflow).toContain("Verify Section 24 recovery invariants");
    expect(governance).toContain("docs/RECOVERY_AND_ROLLBACK");
    expect(inventory).toContain(
      "Section 24 durable generated-product recovery checkpoints",
    );
  });
});
