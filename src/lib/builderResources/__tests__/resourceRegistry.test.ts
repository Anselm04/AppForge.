import { describe, expect, it } from "vitest";
import {
  parseBuilderResourceManifest,
  type BuilderResourceManifestInput,
} from "../resourceManifest.js";
import { BuilderResourceRegistry } from "../resourceRegistry.js";

function resource(
  overrides: Partial<BuilderResourceManifestInput> = {},
): BuilderResourceManifestInput {
  return {
    identity: {
      resourceId: "core.auth.flutter-node",
      name: "Flutter Node Authentication",
      category: "core",
      resourceType: "module",
      version: "1.0.0",
    },
    compatibility: {
      supportedProductTypes: ["mobile_app"],
      supportedTechnologyStacks: ["flutter-node"],
      supportedRuntimes: ["flutter", "node"],
      supportedPlatforms: ["android", "ios"],
      incompatibleCombinations: [],
      minimumRuntimeToolVersions: { node: ">=22.22.1" },
    },
    capabilities: {
      capabilitiesProvided: ["mobile"],
      optionalCapabilities: [],
      dependencies: [],
      integrationPoints: ["auth"],
    },
    contracts: {
      inputContract: { kind: "product-contract" },
      outputContract: { kind: "generated-files" },
      apiContract: null,
      dataContract: null,
      eventsEmitted: [],
      eventsConsumed: [],
      requiredEnvironmentVariables: [],
      secretRequirements: [],
    },
    adaptation: {
      configurableFields: ["profileFields"],
      replacementPoints: [],
      brandingHooks: [],
      localizationHooks: [],
      authorizationHooks: ["rolePolicy"],
      databaseHooks: ["userProfile"],
      extensionPoints: [],
    },
    evidence: {
      unitTests: ["auth.unit"],
      integrationTests: ["auth.integration"],
      behavioralTests: ["auth.behavior"],
      buildEvidence: ["build-1"],
      runtimeEvidence: ["runtime-1"],
      securityEvidence: ["security-1"],
      accessibilityEvidence: [],
      performanceEvidence: [],
      reproducibilityEvidence: ["repro-1"],
      lastVerifiedAt: "2026-10-16T00:00:00.000Z",
      evidenceLedgerIds: ["ledger-1"],
      adapterEvidence: {
        discovered: true,
        installVerified: true,
        compileOrBuildVerified: true,
        testsVerified: true,
        runtimeVerified: true,
        packageVerified: true,
        deploymentVerified: true,
        securityScanVerified: true,
        behavioralVerified: true,
        reproducibleBuild: true,
        evidenceLedgerIds: ["ledger-1"],
      },
    },
    governance: {
      provenance: "appforge-internal",
      license: "UNLICENSED-INTERNAL",
      allowedUse: ["internal-generation"],
      securityNotes: [],
      deprecationStatus: "active",
      replacementResourceId: null,
      maintainerInternalOwner: "appforge",
      maturityState: "production-certified",
      quarantine: null,
    },
    ...overrides,
  };
}

describe("Builder Resource manifest", () => {
  it("accepts a complete evidence-backed internal resource manifest", () => {
    const parsed = parseBuilderResourceManifest(resource());
    expect(parsed.identity.resourceId).toBe("core.auth.flutter-node");
    expect(parsed.governance.maturityState).toBe("production-certified");
  });

  it("rejects production-certified resources when required evidence is missing", () => {
    const input = resource({
      evidence: {
        ...resource().evidence,
        adapterEvidence: {
          discovered: true,
          installVerified: true,
          compileOrBuildVerified: true,
          testsVerified: true,
          runtimeVerified: true,
          packageVerified: true,
          deploymentVerified: true,
          securityScanVerified: true,
          behavioralVerified: false,
          reproducibleBuild: true,
        },
      },
    });

    expect(() => parseBuilderResourceManifest(input)).toThrow(
      /production-certified/i,
    );
  });
});

describe("Builder Resource registry", () => {
  it("filters by requirement fit, stack, platform and maturity and ranks deterministically", () => {
    const registry = new BuilderResourceRegistry([
      parseBuilderResourceManifest(resource()),
      parseBuilderResourceManifest(
        resource({
          identity: {
            ...resource().identity,
            resourceId: "core.auth.react-node",
            name: "React Node Authentication",
            version: "1.1.0",
          },
          compatibility: {
            ...resource().compatibility,
            supportedTechnologyStacks: ["react-node"],
            supportedPlatforms: ["web"],
          },
          governance: {
            ...resource().governance,
            maturityState: "verified",
          },
        }),
      ),
    ]);

    const results = registry.query({
      productType: "mobile_app",
      technologyStack: "flutter-node",
      platform: "android",
      requiredCapabilities: ["mobile"],
      minimumMaturity: "verified",
    });

    expect(results.map((candidate) => candidate.resource.identity.resourceId)).toEqual([
      "core.auth.flutter-node",
    ]);
    expect(results[0]?.reasons).toContain("stack:exact");
    expect(results[0]?.reasons).toContain("platform:android");
  });

  it("excludes quarantined and deprecated resources from normal selection", () => {
    const registry = new BuilderResourceRegistry([
      parseBuilderResourceManifest(
        resource({
          governance: {
            ...resource().governance,
            quarantine: { quarantined: true, reason: "regression" },
          },
        }),
      ),
      parseBuilderResourceManifest(
        resource({
          identity: {
            ...resource().identity,
            resourceId: "core.auth.old",
            name: "Old Authentication",
            version: "0.9.0",
          },
          governance: {
            ...resource().governance,
            deprecationStatus: "deprecated",
            replacementResourceId: "core.auth.flutter-node",
          },
        }),
      ),
    ]);

    expect(
      registry.query({
        technologyStack: "flutter-node",
        requiredCapabilities: ["mobile"],
      }),
    ).toEqual([]);
  });
});
