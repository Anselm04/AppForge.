import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("build SSE replay verification identity", () => {
  const route = readFileSync("src/routes/build.ts", "utf8");

  it("reads persisted current artifact before declaring runtime verification", () => {
    expect(route).toContain("getCurrentArtifact(projectId)");
    expect(route).toContain("executionVerified = assessFactoryExecution(");
    expect(route).toContain("artifact.validationResult,");
    expect(route).toContain("executionVerified,");
    expect(route).toContain("validationPassed: executionVerified,");
    expect(route).toContain("snapshotId: verificationSnapshotId,");
    expect(route).toContain("artifactSha256: verificationArtifactSha256,");
  });

  it("fails closed when persisted evidence cannot be loaded", () => {
    expect(route).toContain("let executionVerified = false;");
    expect(route).toContain("completed_build_replay_unverified");
  });
});
