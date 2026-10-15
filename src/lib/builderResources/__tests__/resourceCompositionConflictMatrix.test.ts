import { describe, expect, it } from "vitest";
import {
  parseBuilderResourceManifest,
  type BuilderResourceManifest,
  type BuilderResourceManifestInput,
} from "../resourceManifest.js";
import { composeBuilderResources } from "../resourceComposition.js";

function manifest(
  id: string,
  composition: BuilderResourceManifestInput["composition"],
  dependencies: string[] = [],
): BuilderResourceManifest {
  return parseBuilderResourceManifest({
    identity: {
      resourceId: id,
      name: id,
      category: "test",
      resourceType: "module",
      version: "1.0.0",
    },
    compatibility: {
      supportedProductTypes: ["*"],
      supportedTechnologyStacks: ["*"],
      supportedRuntimes: ["*"],
      supportedPlatforms: ["*"],
      incompatibleCombinations: [],
      minimumRuntimeToolVersions: {},
    },
    capabilities: {
      capabilitiesProvided: [],
      optionalCapabilities: [],
      dependencies,
      integrationPoints: [],
    },
    contracts: {
      inputContract: {},
      outputContract: {},
      apiContract: null,
      dataContract: null,
      eventsEmitted: [],
      eventsConsumed: [],
      requiredEnvironmentVariables: [],
      secretRequirements: [],
    },
    adaptation: {
      configurableFields: [],
      replacementPoints: [],
      brandingHooks: [],
      localizationHooks: [],
      authorizationHooks: [],
      databaseHooks: [],
      extensionPoints: [],
    },
    composition,
    evidence: {
      unitTests: ["test"],
      integrationTests: [],
      behavioralTests: [],
      buildEvidence: [],
      runtimeEvidence: [],
      securityEvidence: [],
      accessibilityEvidence: [],
      performanceEvidence: [],
      reproducibilityEvidence: [],
      lastVerifiedAt: null,
      evidenceLedgerIds: [],
      adapterEvidence: { discovered: true, installVerified: true },
    },
    governance: {
      provenance: "test",
      license: "UNLICENSED-INTERNAL",
      allowedUse: ["internal-generation"],
      securityNotes: [],
      deprecationStatus: "active",
      replacementResourceId: null,
      maintainerInternalOwner: "appforge",
      maturityState: "structural",
      quarantine: null,
    },
  });
}

describe("Builder Resource composition conflict matrix", () => {
  it("detects environment, API, event, permission, styling, platform and deployment conflicts", () => {
    const first = manifest("first", {
      environmentVariableKinds: { API_TOKEN: "secret" },
      apiContracts: { users: "v1" },
      eventsProduced: ["user.updated"],
      permissionPolicies: { camera: "required" },
      stylingAssignments: { "brand.primary": "gold" },
      platformCapabilityPolicies: { camera: "required" },
      deploymentPolicies: { https: "required" },
    });
    const second = manifest("second", {
      environmentVariableKinds: { API_TOKEN: "public" },
      apiContracts: { users: "v2" },
      eventsProduced: ["user.updated"],
      permissionPolicies: { camera: "forbidden" },
      stylingAssignments: { "brand.primary": "blue" },
      platformCapabilityPolicies: { camera: "forbidden" },
      deploymentPolicies: { https: "forbidden" },
    });

    const kinds = composeBuilderResources([first, second]).conflicts
      .map((conflict) => conflict.kind)
      .sort();
    expect(kinds).toEqual([
      "api-contract",
      "deployment-policy",
      "environment-kind",
      "event-producer",
      "permission-policy",
      "platform-capability",
      "styling-token",
    ]);
  });

  it("detects missing resource dependencies before a plan is viable", () => {
    const dependent = manifest("dependent", {}, ["required.resource"]);
    const composition = composeBuilderResources([dependent]);
    expect(composition.ok).toBe(false);
    expect(composition.conflicts).toContainEqual(
      expect.objectContaining({
        kind: "missing-dependency",
        key: "required.resource",
      }),
    );
  });

  it("allows shared event consumption and compatible policies", () => {
    const first = manifest("producer", {
      eventsProduced: ["booking.available"],
      permissionPolicies: { notifications: "required" },
      deploymentPolicies: { https: "required" },
    });
    const second = manifest("consumer", {
      eventsConsumed: ["booking.available"],
      permissionPolicies: { notifications: "required" },
      deploymentPolicies: { https: "required" },
    });
    expect(composeBuilderResources([first, second]).conflicts).toEqual([]);
  });
});
