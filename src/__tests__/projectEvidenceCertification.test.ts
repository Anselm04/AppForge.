import { describe, expect, it } from "vitest";
import { findProductionVerificationForCurrentArtifact } from "../lib/projectEvidence.js";

describe("project evidence certification identity", () => {
  const oldCheckpoint = {
    source: "production_verified",
    snapshotId: 10,
    artifactVersion: 3,
    artifactSha256: "a".repeat(64),
  };

  it("does not certify a different current snapshot", () => {
    expect(
      findProductionVerificationForCurrentArtifact([oldCheckpoint], {
        id: 11,
        version: 4,
        artifactIntegrity: { sha256: "b".repeat(64) },
      }),
    ).toBeNull();
  });

  it("does not certify when only the version or hash differs", () => {
    expect(
      findProductionVerificationForCurrentArtifact([oldCheckpoint], {
        id: 10,
        version: 4,
        artifactIntegrity: { sha256: "a".repeat(64) },
      }),
    ).toBeNull();

    expect(
      findProductionVerificationForCurrentArtifact([oldCheckpoint], {
        id: 10,
        version: 3,
        artifactIntegrity: { sha256: "b".repeat(64) },
      }),
    ).toBeNull();
  });

  it("certifies only the exact current snapshot identity", () => {
    expect(
      findProductionVerificationForCurrentArtifact([oldCheckpoint], {
        id: 10,
        version: 3,
        artifactIntegrity: { sha256: "a".repeat(64) },
      }),
    ).toEqual(oldCheckpoint);
  });

  it("ignores non-production checkpoints even when artifact identity matches", () => {
    expect(
      findProductionVerificationForCurrentArtifact(
        [{ ...oldCheckpoint, source: "validated_artifact" }],
        {
          id: 10,
          version: 3,
          artifactIntegrity: { sha256: "a".repeat(64) },
        },
      ),
    ).toBeNull();
  });
});
