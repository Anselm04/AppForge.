import {
  parseBuilderResourceManifest,
  type BuilderResourceManifest,
} from "./resourceManifest.js";
import { PROGRAMME_REFERENCE_ARCHITECTURES } from "./programmeReferenceArchitectures.js";

export const REFERENCE_ARCHITECTURE_RESOURCES: BuilderResourceManifest[] =
  PROGRAMME_REFERENCE_ARCHITECTURES.map((architecture) =>
    parseBuilderResourceManifest({
      identity: {
        resourceId: `reference.${architecture.id}`,
        name: architecture.name,
        category: "reference-architecture",
        resourceType: "reference_architecture",
        version: "1.0.0",
      },
      compatibility: {
        supportedProductTypes: [architecture.productType],
        supportedTechnologyStacks: ["*", ...architecture.alternativeStacks],
        supportedRuntimes: ["*"],
        supportedPlatforms: ["*"],
        incompatibleCombinations: [],
        minimumRuntimeToolVersions: {},
      },
      capabilities: {
        capabilitiesProvided: [],
        optionalCapabilities: [],
        dependencies: architecture.recommendedResourceIds,
        integrationPoints: architecture.externalIntegrations,
      },
      contracts: {
        inputContract: {
          commonRequirements: architecture.commonRequirements,
        },
        outputContract: {
          recommendedResourceIds: architecture.recommendedResourceIds,
        },
        apiContract: null,
        dataContract: { entities: architecture.dataModel },
        eventsEmitted: [],
        eventsConsumed: [],
        requiredEnvironmentVariables: [],
        secretRequirements: [],
      },
      adaptation: {
        configurableFields: [
          "architecture.requirements",
          "architecture.stack",
          "architecture.dataModel",
          "architecture.monetization",
        ],
        replacementPoints: ["architecture.resourceComposition"],
        brandingHooks: [],
        localizationHooks: ["locale"],
        authorizationHooks: ["architecture.authModel"],
        databaseHooks: ["architecture.dataModel"],
        extensionPoints: ["architecture.integrations"],
      },
      evidence: {
        unitTests: [
          "src/lib/builderResources/__tests__/governanceRetrievalReference.test.ts",
        ],
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
        provenance: "AppForge-owned composition recipe",
        license: "UNLICENSED-INTERNAL",
        allowedUse: ["internal-generation"],
        securityNotes: architecture.securityConcerns,
        deprecationStatus: "active",
        replacementResourceId: null,
        maintainerInternalOwner: "appforge",
        maturityState: "structural",
        quarantine: null,
      },
      implementation: {
        sourcePaths: [
          "src/lib/builderResources/referenceArchitectures.ts",
          "src/lib/builderResources/programmeReferenceArchitectures.ts",
        ],
        testPaths: [
          "src/lib/builderResources/__tests__/governanceRetrievalReference.test.ts",
        ],
        exportPolicy: "reference-only",
        requiresLiveLibraryAtRuntime: false,
      },
    }),
  );
