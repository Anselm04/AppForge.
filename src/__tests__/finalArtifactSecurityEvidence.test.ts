import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("final artifact security evidence handoff", () => {
  const worker = readFileSync("src/services/build-worker.ts", "utf8");

  it("runs scanner against persisted final files and binds proof to snapshot identity", () => {
    expect(worker).toContain("scanProjectFiles(artifact.files)");
    expect(worker).toContain("validateGeneratedSecurityPosture(");
    expect(worker).toContain('kind: "security"');
    expect(worker).toContain("artifactSha256: artifact.integrity.sha256");
    expect(worker).toContain("snapshotId: artifact.snapshotId");
    expect(worker).toContain("if (blockingFindings.length > 0)");
  });
});
