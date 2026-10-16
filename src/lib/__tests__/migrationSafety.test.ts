import { describe, expect, it } from "vitest";
import {
  assessApiChange,
  assessDatabaseMigration,
} from "../migrationSafety.js";

describe("migration safety", () => {
  it("requires backup evidence for destructive database changes", () => {
    const result = assessDatabaseMigration({
      operations: [{ kind: "drop_column", target: "customers.legacy_id" }],
      backupEvidenceId: null,
      rollbackPlan: "restore legacy_id from backup",
      forwardFixPlan: "recreate and backfill legacy_id",
      seedDataSeparated: true,
    });
    expect(result.safeToApply).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/backup/i);
  });

  it("rejects migrations that mix seed data with schema evolution", () => {
    expect(
      assessDatabaseMigration({
        operations: [{ kind: "add_index", target: "bookings.created_at" }],
        backupEvidenceId: null,
        rollbackPlan: "drop index",
        forwardFixPlan: "rebuild index",
        seedDataSeparated: false,
      }).safeToApply,
    ).toBe(false);
  });

  it("requires explicit versioning for breaking API changes", () => {
    expect(
      assessApiChange({
        removedFields: ["legacyStatus"],
        changedTypes: [],
        removedEndpoints: [],
        versionedReplacement: null,
      }).safeToRelease,
    ).toBe(false);
  });
});
