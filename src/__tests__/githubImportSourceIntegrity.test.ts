import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildActivityLabel,
  isProjectArtifactReady,
} from "../lib/buildStatus.js";

describe("GitHub-imported products are not fake certified applications", () => {
  it("refuses partial imports and resolves the actual default branch", () => {
    const source = readFileSync("src/routers/github.ts", "utf8");
    expect(source).toContain("details.default_branch");
    expect(source).toContain("treeJson.truncated");
    expect(source).toContain("if (blobs.length > 150)");
    expect(source).not.toContain("blobs.slice(0, 150)");
    expect(source).toContain("markImported: true");
    expect(source).not.toContain('updateProjectStatus(projectId, "validated")');
  });

  it("marks imported working source as not validated", () => {
    expect(buildActivityLabel({ status: "pending", buildStage: "generated" })).toBe(
      "Imported source — validation required",
    );
    expect(isProjectArtifactReady("pending")).toBe(false);
    const db = readFileSync("src/db.ts", "utf8");
    expect(db).toContain("options.markImported");
    expect(db).toContain('buildStage: "generated"');
  });
});
