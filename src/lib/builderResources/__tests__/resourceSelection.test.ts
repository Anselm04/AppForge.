import { describe, expect, it } from "vitest";
import type { ProductContract } from "../../productContract.js";
import type { ProductPlan } from "../../productPlan.js";
import type { RequirementManifest } from "../../requirementManifest.js";
import {
  parseBuilderResourceManifest,
  type BuilderResourceManifestInput,
} from "../resourceManifest.js";
import { BuilderResourceRegistry } from "../resourceRegistry.js";
import { selectBuilderResources } from "../resourceSelection.js";

function manifest(
  resourceId: string,
  overrides: Partial<BuilderResourceManifestInput> = {},
): BuilderResourceManifestInput {
  return {
    identity: {
      resourceId,
      name: resourceId,
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
      minimumRuntimeToolVersions: {},
    },
    capabilities: {
      capabilitiesProvided: ["mobile"],
      optionalCapabilities: [],
      dependencies: [],
      integrationPoints: ["authentication"],
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
      databaseHooks: ["users"],
      extensionPoints: [],
    },
    evidence: {
      unitTests: ["unit"],
      integrationTests: ["integration"],
      behavioralTests: ["behavior"],
      buildEvidence: ["build"],
      runtimeEvidence: ["runtime"],
      securityEvidence: ["security"],
      accessibilityEvidence: [],
      performanceEvidence: [],
      reproducibilityEvidence: ["repro"],
      lastVerifiedAt: "2026-10-15T00:00:00.000Z",
      evidenceLedgerIds: ["ledger"],
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

const contract: ProductContract = {
  version: 2,
  originalPrompt: "Build an iPhone and Android booking app with accounts.",
  productType: "mobile_app",
  productFamilies: ["frontend", "backend", "mobile", "auth"],
  targetUsers: ["customers"],
  userRoles: ["user"],
  coreWorkflows: ["sign in", "book"],
  functionalRequirements: [
    {
      id: "REQ-001",
      text: "Users must authenticate before booking.",
      category: "security",
      priority: "must",
    },
  ],
  nonFunctionalRequirements: ["secure"],
  dataModels: ["User", "Booking"],
  integrations: [],
  securityRequirements: ["authenticated access"],
  deploymentRequirements: ["iOS", "Android"],
  monetizationRequirements: [],
  selectedTechnologyStack: "flutter-node",
  researchRequirements: [],
  runtimeRequirements: ["Flutter", "Node"],
  secondaryCapabilities: ["authentication", "database"],
  intentConfidence: 1,
  canonicalInterpretation: "Mobile booking app with authentication.",
};

const plan: ProductPlan = {
  version: 1,
  title: "Booking app",
  overview: "Flutter client and Node API",
  productType: "mobile_app",
  selectedTechnologyStack: "flutter-node",
  architecture: {
    summary: "Flutter + Node",
    workflows: ["sign in", "book"],
    personas: ["Customer"],
    roles: ["user"],
    frontendModules: ["Auth", "Booking"],
    backendModules: ["Auth API", "Booking API"],
    databaseModules: ["Users", "Bookings"],
    aiModules: [],
    integrationModules: [],
    authenticationDesign: "Required",
    authorizationDesign: "Owner-scoped",
    billingDesign: "None",
    deploymentDesign: "iOS + Android + backend",
    operationsDesign: "Structured logs",
    recoveryDesign: "Retry-safe",
    monetizationPlan: "None",
  },
  implementationSequence: ["T1"],
  tasks: [
    {
      id: "T1",
      module: "Auth",
      description: "Implement authentication",
      sequence: 1,
      dependencies: [],
      acceptanceCriteria: ["Authentication required"],
      requirementIds: ["REQ-001"],
      files: ["lib/auth.dart", "server/src/auth.ts"],
      agent: "security",
      validations: ["auth tests"],
    },
  ],
  requirementToTasks: { "REQ-001": ["T1"] },
  taskToFiles: { T1: ["lib/auth.dart", "server/src/auth.ts"] },
  taskToAgent: { T1: "security" },
  taskToValidation: { T1: ["auth tests"] },
  researchDecisionIds: [],
};

const requirementManifest: RequirementManifest = {
  version: 1,
  revision: 1,
  productType: "mobile_app",
  selectedTechnologyStack: "flutter-node",
  originalPrompt: contract.originalPrompt,
  createdAt: "2026-10-15T00:00:00.000Z",
  updatedAt: "2026-10-15T00:00:00.000Z",
  requirements: [
    {
      id: "REQ-001",
      text: "Users must authenticate before booking.",
      priority: "must",
      category: "security",
      source: "canonical_product_contract",
      sourceField: "functionalRequirements",
      taskIds: ["T1"],
      files: ["lib/auth.dart", "server/src/auth.ts"],
      tests: [],
      validations: ["auth tests"],
      implementationHash: null,
      validationEvidence: [],
      deploymentEvidence: [],
      status: "planned",
      unresolvedReason: null,
    },
  ],
  capabilityDependencies: [],
  changes: [],
  unresolvedMustHaveIds: ["REQ-001"],
};

describe("Builder Resource selection", () => {
  it("selects compatible proven resources and records why they fit", () => {
    const registry = new BuilderResourceRegistry([
      parseBuilderResourceManifest(manifest("core.auth.flutter-node")),
      parseBuilderResourceManifest(
        manifest("core.auth.web", {
          compatibility: {
            ...manifest("x").compatibility,
            supportedTechnologyStacks: ["react-node"],
            supportedPlatforms: ["web"],
          },
        }),
      ),
    ]);

    const selection = selectBuilderResources({
      registry,
      productContract: contract,
      productPlan: plan,
      requirementManifest,
      targetPlatform: "android",
      requiredCapabilities: ["mobile"],
      now: "2026-10-16T00:00:00.000Z",
    });

    expect(selection.selected).toHaveLength(1);
    expect(selection.selected[0]?.resource.identity.resourceId).toBe(
      "core.auth.flutter-node",
    );
    expect(selection.selected[0]?.reasons).toContain("stack:exact");
    expect(selection.selected[0]?.reasons).toContain("platform:android");
    expect(selection.selected[0]?.decision.requirementIds).toEqual(["REQ-001"]);
    expect(selection.selected[0]?.decision.evidenceLedgerIds).toContain("ledger");
  });

  it("rejects stale or unlicensed candidates when stricter constraints require it", () => {
    const registry = new BuilderResourceRegistry([
      parseBuilderResourceManifest(
        manifest("core.auth.stale", {
          evidence: {
            ...manifest("x").evidence,
            lastVerifiedAt: "2025-01-01T00:00:00.000Z",
          },
        }),
      ),
      parseBuilderResourceManifest(
        manifest("core.auth.forbidden-license", {
          governance: {
            ...manifest("x").governance,
            license: "PROPRIETARY-EXTERNAL",
            allowedUse: ["reference-only"],
          },
        }),
      ),
    ]);

    const selection = selectBuilderResources({
      registry,
      productContract: contract,
      productPlan: plan,
      requirementManifest,
      targetPlatform: "android",
      requiredCapabilities: ["mobile"],
      maximumVerificationAgeDays: 30,
      requiredAllowedUse: "internal-generation",
      now: "2026-10-16T00:00:00.000Z",
    });

    expect(selection.selected).toEqual([]);
    expect(selection.rejected.map((candidate) => candidate.resourceId).sort()).toEqual([
      "core.auth.forbidden-license",
      "core.auth.stale",
    ]);
  });
});
