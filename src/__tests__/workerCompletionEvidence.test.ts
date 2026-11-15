import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("build-worker completion is bound to actual execution proof", () => {
  const worker = readFileSync("src/services/build-worker.ts", "utf8");

  it("uses the canonical execution decision for runtime claims", () => {
    expect(worker).toContain("assessFactoryExecution(");
    expect(worker).toContain("executionDecision.verified");
    expect(worker).toContain("structuralOnly: !runtimeVerified");
  });

  it("sends exact artifact identity and explicit proof in both done paths", () => {
    expect(worker.match(/executionVerified: runtimeVerified,/g)).toHaveLength(
      2,
    );
    expect(worker.match(/validationPassed: runtimeVerified,/g)).toHaveLength(2);
    expect(
      worker.match(/snapshotId: artifact.snapshotId,/g)?.length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      worker.match(/artifactSha256: artifact.integrity.sha256,/g)?.length,
    ).toBeGreaterThanOrEqual(2);
  });
});
