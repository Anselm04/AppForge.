import { describe, expect, it } from "vitest";
import {
  assessRollback,
  createUpgradeCandidate,
} from "../versionRollback.js";

describe("version and rollback lifecycle", () => {
  it("never silently upgrades a resource version", () => {
    const candidate = createUpgradeCandidate({
      resourceId: "auth-core",
      currentVersion: "1.2.0",
      candidateVersion: "1.3.0",
    });
    expect(candidate.status).toBe("pending-evidence");
    expect(candidate.productionEvidenceInherited).toBe(false);
  });

  it("requires forward recovery when data cannot safely roll back", () => {
    const result = assessRollback({
      codeVersion: true,
      databaseVersion: false,
      providerConfig: true,
      webhooks: true,
      jobs: true,
      flags: true,
      resourceVersions: true,
      dataRollbackSafe: false,
    });
    expect(result.safe).toBe(false);
    expect(result.strategy).toBe("forward-recovery");
  });
});
