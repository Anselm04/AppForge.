import {
  parseBuilderResourceManifest,
  type BuilderResourceManifest,
} from "./resourceManifest.js";

export const RESEARCH_EVIDENCE_RESOURCE: BuilderResourceManifest =
  parseBuilderResourceManifest({
    identity: {
      resourceId: "module.research-evidence",
      name: "Research Evidence Ranking and Cache",
      category: "web_search",
      resourceType: "module",
      version: "1.0.0",
    },
    compatibility: {
      supportedProductTypes: ["*"],
      supportedTechnologyStacks: ["*"],
      supportedRuntimes: ["node"],
      supportedPlatforms: ["*"],
      incompatibleCombinations: [],
      minimumRuntimeToolVersions: {},
    },
    capabilities: {
      capabilitiesProvided: ["web_search"],
      optionalCapabilities: [],
      dependencies: [],
      integrationPoints: ["research", "provenance", "freshness", "cache"],
    },
    contracts: {
      inputContract: { kind: "research-source-records" },
      outputContract: { kind: "ranked-evidence-with-conflicts" },
      apiContract: null,
      dataContract: { provenanceRequired: true, freshnessRequired: true },
      eventsEmitted: [],
      eventsConsumed: [],
      requiredEnvironmentVariables: [],
      secretRequirements: [],
    },
    adaptation: {
      configurableFields: ["research.authorityWeights", "research.cacheTtl"],
      replacementPoints: [],
      brandingHooks: [],
      localizationHooks: [],
      authorizationHooks: [],
      databaseHooks: ["research.cache"],
      extensionPoints: ["research.sourceProvider"],
    },
    implementation: {
      sourcePaths: [
        "src/lib/builderResources/researchResource.ts",
        "src/services/webSearch.ts",
        "src/lib/researchEvidence.ts",
      ],
      testPaths: [
        "src/lib/builderResources/__tests__/researchResource.test.ts",
      ],
      exportPolicy: "compose",
      requiresLiveLibraryAtRuntime: false,
    },
    evidence: {
      unitTests: [
        "src/lib/builderResources/__tests__/researchResource.test.ts",
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
      provenance: "AppForge-owned research evidence helpers",
      license: "UNLICENSED-INTERNAL",
      allowedUse: ["internal-generation"],
      securityNotes: ["Retrieved source content must retain provenance and freshness metadata"],
      deprecationStatus: "active",
      replacementResourceId: null,
      maintainerInternalOwner: "appforge",
      maturityState: "structural",
      quarantine: null,
    },
  });
