import { describe, expect, it } from "vitest";
import { buildEngineeringVerificationRecord } from "../lib/engineeringVerification.js";
import { runnerSourceSha256 } from "../lib/runnerSourceDigest.js";

const sha = "a".repeat(64);
const snapshot = {
  id: 8,
  version: 3,
  fileCount: 6,
  artifactIntegrity: { sha256: sha },
  validationResult: { passed: true, stage: "runtime", errors: [] },
};

describe("artifact-bound engineering verification", () => {
  it("never upgrades an unverified project by assertion alone", () => {
    const record = buildEngineeringVerificationRecord({
      currentSnapshot: snapshot,
      events: [],
      checkpoints: [],
      isMobile: false,
    });
    expect(record.status).toBe("incomplete");
    expect(record.checks.find((check) => check.id === "validation")?.state).toBe(
      "passed",
    );
    expect(record.checks.find((check) => check.id === "security")?.state).toBe(
      "unverified",
    );
    expect(record.checks.find((check) => check.id === "preview")?.state).toBe(
      "unverified",
    );
  });

  it("rejects old-version and mismatched-hash evidence", () => {
    const record = buildEngineeringVerificationRecord({
      currentSnapshot: snapshot,
      events: [
        {
          id: 1,
          kind: "security",
          artifactVersion: 2,
          payload: { passed: true, snapshotId: 8, artifactSha256: sha },
        },
        {
          id: 2,
          kind: "deployment",
          artifactVersion: 3,
          payload: {
            success: true,
            destination: "preview",
            previewVerified: true,
            snapshotId: 8,
            artifactSha256: "b".repeat(64),
          },
        },
      ],
      checkpoints: [],
      isMobile: false,
    });
    expect(record.status).toBe("incomplete");
    expect(
      record.checks
        .filter((check) => check.state === "passed")
        .map((check) => check.id),
    ).toEqual(["saved_artifact", "validation"]);
  });

  it("accepts only matching persisted proof and never claims app-store release", () => {
    const record = buildEngineeringVerificationRecord({
      currentSnapshot: snapshot,
      events: [
        {
          id: 16,
          kind: "validation",
          artifactVersion: 3,
          payload: {
            snapshotId: 8,
            artifactSha256: sha,
            nativeAnalysisPassed: true,
            nativeBuildPassed: true,
            backendIntegrationPassed: true,
          },
        },
        {
          id: 17,
          kind: "security",
          artifactVersion: 3,
          payload: { passed: true, snapshotId: 8, artifactSha256: sha },
        },
        {
          id: 19,
          kind: "deployment",
          artifactVersion: 3,
          payload: {
            success: true,
            destination: "preview",
            previewVerified: true,
            snapshotId: 8,
            artifactSha256: sha,
          },
        },
      ],
      checkpoints: [
        {
          id: 21,
          source: "production_verified",
          snapshotId: 8,
          artifactVersion: 3,
          artifactSha256: sha,
        },
      ],
      isMobile: true,
    });
    expect(record.status).toBe("verified");
    expect(
      record.checks.find((check) => check.id === "production_deployment")?.state,
    ).toBe("passed");
    expect(
      record.checks.find((check) => check.id === "mobile_distribution")?.state,
    ).toBe("unverified");
  });

  it("accepts persisted native toolchain evidence for the exact saved snapshot", () => {
    const record = buildEngineeringVerificationRecord({
      currentSnapshot: {
        ...snapshot,
        files: { "pubspec.yaml": "name: appforge_test", "lib/main.dart": "void main() {}" },
        validationResult: {
          passed: true,
          stage: "isolated_runtime",
          nativeEvidence: {
            runnerArtifactSha256: runnerSourceSha256({
              "pubspec.yaml": "name: appforge_test",
              "lib/main.dart": "void main() {}",
            }),
            flutterAnalyzePassed: true,
            flutterTestPassed: true,
            androidBuildPassed: true,
            iosSimulatorBuildPassed: true,
            backendIntegrationPassed: true,
          },
        },
      },
      events: [],
      checkpoints: [],
      isMobile: true,
    });
    expect(
      record.checks.find((check) => check.id === "validation")?.state,
    ).toBe("passed");
    expect(record.status).toBe("incomplete");
    expect(
      record.checks.find((check) => check.id === "mobile_distribution")?.state,
    ).toBe("unverified");
  });

  it("rejects native evidence from a different generated source revision", () => {
    const record = buildEngineeringVerificationRecord({
      currentSnapshot: {
        ...snapshot,
        files: { "lib/main.dart": "void main() { print('edited'); }" },
        validationResult: {
          passed: true,
          stage: "isolated_runtime",
          nativeEvidence: {
            runnerArtifactSha256: runnerSourceSha256({
              "lib/main.dart": "void main() {}",
            }),
            flutterAnalyzePassed: true,
            flutterTestPassed: true,
            androidBuildPassed: true,
            iosSimulatorBuildPassed: true,
            backendIntegrationPassed: true,
          },
        },
      },
      events: [],
      checkpoints: [],
      isMobile: true,
    });
    expect(
      record.checks.find((check) => check.id === "validation")?.state,
    ).toBe("unverified");
  });

  it("does not certify structural Flutter output as an executable app", () => {
    const record = buildEngineeringVerificationRecord({
      currentSnapshot: {
        ...snapshot,
        validationResult: { passed: true, stage: "structure" },
      },
      events: [],
      checkpoints: [],
      isMobile: true,
    });
    expect(record.status).toBe("incomplete");
    expect(
      record.checks.find((check) => check.id === "validation")?.state,
    ).toBe("unverified");
  });

  it("marks missing or tampered artifact identity as unverified", () => {
    const record = buildEngineeringVerificationRecord({
      currentSnapshot: {
        ...snapshot,
        artifactIntegrity: { sha256: "invalid" },
      },
      events: [],
      checkpoints: [],
      isMobile: true,
    });
    expect(record.status).toBe("incomplete");
    expect(record.checks.every((check) => check.state === "unverified")).toBe(
      true,
    );
  });
});
