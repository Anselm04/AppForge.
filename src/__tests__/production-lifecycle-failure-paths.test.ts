import { describe, expect, it, vi } from "vitest";
import {
  completeAccountDeletion,
  type AccountDeletionDependencies,
} from "../lib/accountLifecycle.js";
import { decideCreditSettlement } from "../lib/creditSettlement.js";
import { assessDatabaseMigration } from "../lib/migrationSafety.js";
import { publicClaimForEvidence } from "../lib/publicCapabilityClaims.js";
import { assessRollback } from "../lib/versionRollback.js";

describe("production lifecycle failure paths", () => {
  it("halts account cleanup when identity revocation cannot be proven", async () => {
    const deps: AccountDeletionDependencies = {
      loadUser: vi.fn(async () => ({ id: 3, openId: "identity-3" })),
      beginDeletion: vi.fn(async () => undefined),
      stopCustomerWork: vi.fn(async () => undefined),
      disableEntitlements: vi.fn(async () => undefined),
      revokeIdentity: vi.fn(async () => {
        throw new Error("identity provider unavailable");
      }),
      deleteCustomerProjects: vi.fn(async () => undefined),
      deleteProviderConnections: vi.fn(async () => undefined),
      anonymizeAccount: vi.fn(async () => undefined),
      recordAudit: vi.fn(async () => undefined),
    };
    await expect(completeAccountDeletion(3, deps)).rejects.toThrow(
      /provider unavailable/i,
    );
    expect(deps.deleteCustomerProjects).not.toHaveBeenCalled();
    expect(deps.anonymizeAccount).not.toHaveBeenCalled();
  });

  it("blocks destructive data migration when backup evidence disappears", () => {
    expect(
      assessDatabaseMigration({
        operations: [{ kind: "drop_column", target: "customers.phone" }],
        backupEvidenceId: null,
        rollbackPlan: "restore backup",
        forwardFixPlan: "recreate and backfill",
        seedDataSeparated: true,
      }).safeToApply,
    ).toBe(false);
  });

  it("switches to forward recovery when rollback cannot restore data state", () => {
    expect(
      assessRollback({
        codeVersion: true,
        databaseVersion: true,
        providerConfig: true,
        webhooks: true,
        jobs: true,
        flags: true,
        resourceVersions: true,
        dataRollbackSafe: false,
      }).strategy,
    ).toBe("forward-recovery");
  });

  it("downgrades a previously verified capability after regression", () => {
    expect(
      publicClaimForEvidence({
        adapter: "verified",
        resource: "verified",
        runtime: "verified",
        platform: "verified",
        regressionHealthy: false,
      }).canPromise,
    ).toBe(false);
  });

  it("restores credits for duplicate execution instead of double charging", () => {
    const result = decideCreditSettlement({
      kind: "duplicate",
      usefulWorkDelivered: false,
      creditsReserved: 5,
      creditsCharged: 0,
      customerCaused: false,
      buildRef: "duplicate-1",
    });
    expect(result.outcome).toBe("released");
    expect(result.amount).toBe(5);
  });
});
