import { describe, expect, it } from "vitest";
import {
  ADAPTER_CAPABILITY_STATES,
  applyAdapterPromotion,
  clearQuarantine,
  evaluateAdapterPromotion,
  isAtLeast,
  quarantineAdapter,
  stateRank,
  type TechnologyAdapterDescriptor,
} from "../adapterSdk.js";

function baseAdapter(): TechnologyAdapterDescriptor {
  return {
    id: "test-adapter",
    label: "Test Adapter",
    category: "compiler_runtime",
    version: 1,
    supportedVersions: ["1.0"],
    latestCompatibleStableVersion: "1.0",
    lifecycleStatus: "active",
    deprecationNotice: null,
    eolDate: null,
    supportedPlatforms: ["linux"],
    supportedArchitectures: ["x86_64"],
    installation: {
      method: "test",
      requiresProvisioning: false,
      requiredToolchain: [],
    },
    authentication: {
      required: false,
      kind: "none",
      credentialIsolation: "not_applicable",
    },
    commands: {
      install: [],
      build: null,
      test: null,
      runtime: null,
      packaging: null,
      deploy: null,
      healthCheck: null,
    },
    capabilityTests: [],
    securityChecks: [],
    evidenceRequirements: ["discovered"],
    replacementPath: {
      successorAvailable: false,
      successorIdentifier: null,
      migrationNotes: null,
    },
    state: "discovered",
    evidence: { discovered: true },
    quarantine: null,
    lastVerifiedAt: null,
  };
}

describe("adapter capability state ordering", () => {
  it("orders states from unsupported to production-certified", () => {
    expect(ADAPTER_CAPABILITY_STATES[0]).toBe("unsupported");
    expect(ADAPTER_CAPABILITY_STATES.at(-1)).toBe("production-certified");
    expect(stateRank("verified")).toBeGreaterThan(stateRank("runnable"));
  });

  it("isAtLeast compares ranks correctly", () => {
    expect(isAtLeast("verified", "runnable")).toBe(true);
    expect(isAtLeast("discovered", "runnable")).toBe(false);
  });
});

describe("evaluateAdapterPromotion", () => {
  it("rejects promotion with insufficient evidence", () => {
    const result = evaluateAdapterPromotion("discovered", "runnable", {
      discovered: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missingEvidence).toContain("installVerified");
      expect(result.missingEvidence).toContain("compileOrBuildVerified");
      expect(result.missingEvidence).toContain("runtimeVerified");
    }
  });

  it("approves promotion when all required evidence is present", () => {
    const result = evaluateAdapterPromotion("discovered", "runnable", {
      discovered: true,
      installVerified: true,
      compileOrBuildVerified: true,
      runtimeVerified: true,
    });
    expect(result).toEqual({ ok: true, state: "runnable" });
  });

  it("rejects non-advancing or backward promotion", () => {
    const result = evaluateAdapterPromotion("verified", "runnable", {
      discovered: true,
    });
    expect(result.ok).toBe(false);
  });

  it("never allows production-certified without a reproducible build", () => {
    const result = evaluateAdapterPromotion(
      "verified",
      "production-certified",
      {
        discovered: true,
        installVerified: true,
        compileOrBuildVerified: true,
        runtimeVerified: true,
        packageVerified: true,
        deploymentVerified: true,
        testsVerified: true,
        securityScanVerified: true,
        behavioralVerified: true,
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.missingEvidence).toContain("reproducibleBuild");
  });
});

describe("applyAdapterPromotion", () => {
  it("merges evidence and advances state on success", () => {
    const adapter = baseAdapter();
    const promoted = applyAdapterPromotion(
      adapter,
      "buildable",
      { installVerified: true, compileOrBuildVerified: true },
      "2026-01-01T00:00:00.000Z",
    );
    expect(promoted.state).toBe("buildable");
    expect(promoted.evidence.discovered).toBe(true);
    expect(promoted.lastVerifiedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(promoted.quarantine).toBeNull();
  });

  it("throws rather than silently promoting without evidence", () => {
    const adapter = baseAdapter();
    expect(() =>
      applyAdapterPromotion(
        adapter,
        "verified",
        {},
        "2026-01-01T00:00:00.000Z",
      ),
    ).toThrow();
  });
});

describe("quarantine", () => {
  it("demotes a structural-or-above adapter and records the reason", () => {
    const adapter = { ...baseAdapter(), state: "runnable" as const };
    const quarantined = quarantineAdapter(
      adapter,
      "Build started failing against v2.0",
    );
    expect(quarantined.state).toBe("experimental");
    expect(quarantined.quarantine).toEqual({
      quarantined: true,
      reason: "Build started failing against v2.0",
    });
  });

  it("does not report a quarantined adapter as production-ready", () => {
    const adapter = {
      ...baseAdapter(),
      state: "production-certified" as const,
    };
    const quarantined = quarantineAdapter(adapter, "Security scan regressed");
    expect(isAtLeast(quarantined.state, "verified")).toBe(false);
  });

  it("clearQuarantine removes the quarantine flag without changing state", () => {
    const quarantined = quarantineAdapter(
      { ...baseAdapter(), state: "runnable" as const },
      "transient",
    );
    const cleared = clearQuarantine(quarantined);
    expect(cleared.quarantine).toBeNull();
    expect(cleared.state).toBe(quarantined.state);
  });
});
