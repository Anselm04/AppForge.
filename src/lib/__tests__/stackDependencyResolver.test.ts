import { describe, expect, it } from "vitest";
import {
  buildDependencyEvidence,
  resolveStackDependencyGraph,
} from "../stackDependencyResolver.js";
import { STACK_EXTERNAL_DEPENDENCIES } from "../stackDependencies.js";
import {
  EXTERNAL_TECHNOLOGY_ADAPTERS,
  getExternalTechnologyAdapter,
} from "../externalTechnologyAdapters.js";
import type { TechnologyAdapterDescriptor } from "../adapterSdk.js";

function fakeAdapter(
  overrides: Partial<TechnologyAdapterDescriptor>,
): TechnologyAdapterDescriptor {
  return {
    id: "fake-adapter",
    label: "Fake Adapter",
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
    state: "verified",
    evidence: {
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
    quarantine: null,
    lastVerifiedAt: null,
    ...overrides,
  };
}

const ONE_DEP = [
  {
    adapterId: "fake-adapter",
    versionConstraint: "any",
    minimumCapabilityLevel: "runnable" as const,
    purpose: "runtime",
  },
];

describe("stack dependency graph resolution against the real registry", () => {
  it("resolves a verified, production-eligible path for a real runnable stack", () => {
    const graph = resolveStackDependencyGraph("api-service");
    expect(graph.stackId).toBe("api-service");
    expect(graph.dependencies).toHaveLength(1);
    expect(graph.dependencies[0]).toMatchObject({
      adapterId: "node-runtime",
      status: "resolved",
      resolvedState: "verified",
    });
    expect(graph.allowed).toBe(true);
    expect(graph.productionEligible).toBe(true);
    expect(graph.capabilityCeiling).toBe("verified");
  });

  it("allows but does not production-certify a stack whose dependency is runnable but not verified", () => {
    const graph = resolveStackDependencyGraph("python-service");
    expect(graph.allowed).toBe(true);
    expect(graph.productionEligible).toBe(false);
    expect(graph.dependencies[0].resolvedState).toBe("runnable");
    expect(graph.capabilityCeiling).toBe("runnable");
    expect(graph.dependencies[0].runnerAvailable).toBe(true);
  });

  it("has no dependency for stacks with no external technology requirement", () => {
    const graph = resolveStackDependencyGraph("static-html");
    expect(graph.dependencies).toEqual([]);
    expect(graph.allowed).toBe(true);
    expect(graph.productionEligible).toBe(true);
  });

  it("every declared stack dependency references a real registered adapter", () => {
    for (const [stackId, deps] of Object.entries(STACK_EXTERNAL_DEPENDENCIES)) {
      for (const dep of deps) {
        expect(
          getExternalTechnologyAdapter(dep.adapterId),
          `${stackId} -> ${dep.adapterId}`,
        ).toBeTruthy();
      }
    }
  });

  it("flags insufficient capability level for electron-react's unverified desktop toolchain", () => {
    const graph = resolveStackDependencyGraph("electron-react");
    const desktopDep = graph.dependencies.find(
      (d) => d.adapterId === "electron-desktop",
    );
    expect(desktopDep?.status).toBe("resolved");
    expect(desktopDep?.resolvedState).toBe("discovered");
    expect(graph.allowed).toBe(true);
    expect(graph.productionEligible).toBe(false);
  });

  it("records adapter id, resolved version and state as build evidence", () => {
    const graph = resolveStackDependencyGraph("api-service");
    const evidence = buildDependencyEvidence(graph);
    expect(evidence).toEqual([
      {
        adapterId: "node-runtime",
        purpose: "runtime",
        resolvedVersion: "22",
        resolvedState: "verified",
        status: "resolved",
      },
    ]);
  });

  it("builds the full Product -> Stack -> Adapters -> Runner -> Evidence graph shape", () => {
    const graph = resolveStackDependencyGraph("react-node", "website");
    expect(graph.productType).toBe("website");
    expect(graph.stackId).toBe("react-node");
    for (const node of graph.dependencies) {
      expect(typeof node.runnerAvailable).toBe("boolean");
      expect(typeof node.message).toBe("string");
    }
  });

  it("throws for an unknown stack id instead of silently returning an empty graph", () => {
    expect(() => resolveStackDependencyGraph("not-a-real-stack")).toThrow();
  });

  it("uses only adapters that genuinely exist; node-runtime 999 is correctly unsupported", () => {
    const nodeRuntime = EXTERNAL_TECHNOLOGY_ADAPTERS.find(
      (a) => a.id === "node-runtime",
    )!;
    expect(nodeRuntime.supportedVersions.includes("999")).toBe(false);
  });
});

describe("stack dependency graph resolution with an injected adapter lookup", () => {
  it("refuses the build when the declared adapter does not exist", () => {
    const graph = resolveStackDependencyGraph("api-service", undefined, {
      dependencies: ONE_DEP,
      lookupAdapter: () => undefined,
    });
    expect(graph.dependencies[0].status).toBe("missing_adapter");
    expect(graph.allowed).toBe(false);
    expect(graph.productionEligible).toBe(false);
    expect(graph.capabilityCeiling).toBe("unsupported");
  });

  it("refuses the build when the required adapter is quarantined", () => {
    const graph = resolveStackDependencyGraph("api-service", undefined, {
      dependencies: ONE_DEP,
      lookupAdapter: () =>
        fakeAdapter({
          quarantine: { quarantined: true, reason: "CI regression" },
        }),
    });
    expect(graph.dependencies[0].status).toBe("quarantined");
    expect(graph.allowed).toBe(false);
    expect(graph.productionEligible).toBe(false);
  });

  it("refuses the build when the required adapter is retired", () => {
    const graph = resolveStackDependencyGraph("api-service", undefined, {
      dependencies: ONE_DEP,
      lookupAdapter: () => fakeAdapter({ lifecycleStatus: "retired" }),
    });
    expect(graph.dependencies[0].status).toBe("retired_blocked");
    expect(graph.allowed).toBe(false);
  });

  it("resolves but withholds production eligibility for a deprecated adapter", () => {
    const graph = resolveStackDependencyGraph("api-service", undefined, {
      dependencies: ONE_DEP,
      lookupAdapter: () =>
        fakeAdapter({
          lifecycleStatus: "deprecated",
          deprecationNotice: "Superseded by fake-adapter-v2",
        }),
    });
    expect(graph.dependencies[0].status).toBe("resolved_deprecated");
    // Deprecated adapters can still build (not blocking)...
    expect(graph.allowed).toBe(true);
    // ...but must never be chosen for a production-certified build.
    expect(graph.productionEligible).toBe(false);
  });

  it("refuses the build when the resolved version is not supported", () => {
    const graph = resolveStackDependencyGraph("api-service", undefined, {
      dependencies: [
        {
          adapterId: "fake-adapter",
          versionConstraint: "999",
          minimumCapabilityLevel: "runnable",
          purpose: "runtime",
        },
      ],
      lookupAdapter: () => fakeAdapter({}),
    });
    expect(graph.dependencies[0].status).toBe("version_incompatible");
    expect(graph.allowed).toBe(false);
  });

  it("flags insufficient capability level when the adapter hasn't reached the required state", () => {
    const graph = resolveStackDependencyGraph("api-service", undefined, {
      dependencies: [
        {
          adapterId: "fake-adapter",
          versionConstraint: "any",
          minimumCapabilityLevel: "packageable",
          purpose: "runtime",
        },
      ],
      lookupAdapter: () => fakeAdapter({ state: "runnable" }),
    });
    expect(graph.dependencies[0].status).toBe("insufficient_capability");
    expect(graph.allowed).toBe(false);
    expect(graph.capabilityCeiling).toBe("unsupported");
  });

  it("allows and production-certifies a fully verified adapter path", () => {
    const graph = resolveStackDependencyGraph("api-service", undefined, {
      dependencies: ONE_DEP,
      lookupAdapter: () => fakeAdapter({}),
    });
    expect(graph.dependencies[0].status).toBe("resolved");
    expect(graph.allowed).toBe(true);
    expect(graph.productionEligible).toBe(true);
    expect(graph.capabilityCeiling).toBe("verified");

    const evidence = buildDependencyEvidence(graph);
    expect(evidence).toEqual([
      {
        adapterId: "fake-adapter",
        purpose: "runtime",
        resolvedVersion: "1.0",
        resolvedState: "verified",
        status: "resolved",
      },
    ]);
  });
});
