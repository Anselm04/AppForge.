import { describe, expect, it } from "vitest";
import {
  advanceMigrationStep,
  computeLifecycleAlerts,
  MIGRATION_FLOW_STEPS,
  startAdapterMigration,
} from "../adapterLifecycle.js";
import type { TechnologyAdapterDescriptor } from "../adapterSdk.js";

function makeAdapter(
  overrides: Partial<TechnologyAdapterDescriptor> = {},
): TechnologyAdapterDescriptor {
  return {
    id: "demo-adapter",
    label: "Demo Adapter",
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
    ...overrides,
  };
}

describe("computeLifecycleAlerts", () => {
  const now = new Date("2026-10-01T00:00:00.000Z");

  it("flags an adapter that already passed its EOL date", () => {
    const adapter = makeAdapter({ eolDate: "2026-01-01" });
    const alerts = computeLifecycleAlerts([adapter], now);
    expect(alerts.some((a) => a.kind === "eol_passed")).toBe(true);
  });

  it("flags an adapter approaching EOL within the warning window", () => {
    const adapter = makeAdapter({ eolDate: "2026-10-30" });
    const alerts = computeLifecycleAlerts([adapter], now);
    expect(alerts.some((a) => a.kind === "eol_approaching")).toBe(true);
  });

  it("does not flag EOL for a date far in the future", () => {
    const adapter = makeAdapter({ eolDate: "2030-01-01" });
    const alerts = computeLifecycleAlerts([adapter], now);
    expect(alerts.some((a) => a.kind.startsWith("eol"))).toBe(false);
  });

  it("flags deprecated adapters", () => {
    const adapter = makeAdapter({ lifecycleStatus: "deprecated" });
    const alerts = computeLifecycleAlerts([adapter], now);
    expect(alerts.some((a) => a.kind === "deprecated")).toBe(true);
  });

  it("flags quarantined adapters", () => {
    const adapter = makeAdapter({
      quarantine: { quarantined: true, reason: "regression" },
    });
    const alerts = computeLifecycleAlerts([adapter], now);
    expect(alerts.some((a) => a.kind === "quarantined")).toBe(true);
  });

  it("flags adapters with stale verification", () => {
    const adapter = makeAdapter({ lastVerifiedAt: "2025-01-01T00:00:00.000Z" });
    const alerts = computeLifecycleAlerts([adapter], now);
    expect(alerts.some((a) => a.kind === "stale_verification")).toBe(true);
  });

  it("does not flag recently verified adapters as stale", () => {
    const adapter = makeAdapter({ lastVerifiedAt: "2026-09-15T00:00:00.000Z" });
    const alerts = computeLifecycleAlerts([adapter], now);
    expect(alerts.some((a) => a.kind === "stale_verification")).toBe(false);
  });
});

describe("adapter migration plans", () => {
  it("starts with every step pending and outcome in_progress", () => {
    const adapter = makeAdapter();
    const plan = startAdapterMigration(adapter, "2.0");
    expect(plan.steps).toHaveLength(MIGRATION_FLOW_STEPS.length);
    expect(plan.steps.every((s) => s.status === "pending")).toBe(true);
    expect(plan.outcome).toBe("in_progress");
  });

  it("promotes only once every step has passed", () => {
    const adapter = makeAdapter();
    let plan = startAdapterMigration(adapter, "2.0");
    for (const step of MIGRATION_FLOW_STEPS) {
      plan = advanceMigrationStep(plan, step, "passed");
    }
    expect(plan.outcome).toBe("promoted");
  });

  it("rejects the plan the moment a step fails and stops advancing", () => {
    const adapter = makeAdapter();
    let plan = startAdapterMigration(adapter, "2.0");
    plan = advanceMigrationStep(plan, "detect_change", "passed");
    plan = advanceMigrationStep(
      plan,
      "research_official_documentation",
      "failed",
      "Official docs contradict changelog",
    );
    expect(plan.outcome).toBe("rejected");

    // Further advancement must not silently resurrect a rejected plan.
    const after = advanceMigrationStep(plan, "verify_behavior", "passed");
    expect(after.outcome).toBe("rejected");
    expect(after.steps.find((s) => s.step === "verify_behavior")?.status).toBe(
      "pending",
    );
  });
});
