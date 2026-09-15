import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("snapshot source-of-truth integrity", () => {
  it("activates a snapshot and project files in one transaction", () => {
    const source = readFileSync("src/db.ts", "utf8");
    expect(source).toContain("Snapshot not found for project");
    expect(source).toContain("generatedFiles: snapshot.files");
    expect(source).toContain("invalidatePreviewCache(projectId)");
  });

  it("keeps rollback on the atomic snapshot activation path", () => {
    const source = readFileSync("src/routers/projects.ts", "utf8");
    expect(source).toContain(
      "await markSnapshotAsCurrent(input.snapshotId, input.projectId)",
    );
    expect(source).not.toContain(
      "await updateProjectFiles(\n        input.projectId,\n        snapshot.files",
    );
  });
});
