import {
  BUILD_CAPABILITY_IDS,
  type BuildCapabilityId,
} from "../buildCapabilities.js";
import {
  parseBuilderResourceManifest,
  type BuilderResourceManifest,
} from "./resourceManifest.js";

const EXISTING_DOMAIN_SOURCES: Record<BuildCapabilityId, string[]> = {
  web_search: [
    "src/services/webSearch.ts",
    "src/agents/researchAgent.ts",
    "src/lib/researchEvidence.ts",
  ],
  video: ["src/pages/VideoStudio.tsx"],
  graphics: ["src/pages/GraphicsEditor.tsx", "src/lib/graphicsEditorTypes.ts"],
  music: ["src/pages/MusicStudio.tsx"],
  marketing: ["src/pages/MarketingStudio.tsx"],
  ar: ["src/pages/ARStudio.tsx"],
  education: ["src/pages/EducationStudio.tsx"],
  patent: ["src/pages/PatentStudio.tsx"],
  architecture: [
    "src/pages/ArchitectureStudio.tsx",
    "src/lib/architectureProcedures.ts",
  ],
  game: [
    "src/lib/extensionCapabilities.ts",
    "src/routers/extensionProcedures.ts",
  ],
  cad: [
    "src/lib/extensionCapabilities.ts",
    "src/routers/extensionProcedures.ts",
  ],
  legal: [
    "src/lib/extensionCapabilities.ts",
    "src/routers/extensionProcedures.ts",
  ],
  fintech: [
    "src/lib/extensionCapabilities.ts",
    "src/routers/extensionProcedures.ts",
  ],
  healthcare: [
    "src/lib/extensionCapabilities.ts",
    "src/routers/extensionProcedures.ts",
  ],
  mobile: ["src/lib/codeGeneration.ts", "src/lib/productCapabilityAdapters.ts"],
  voice: ["src/lib/codeGeneration.ts", "src/lib/productCapabilityAdapters.ts"],
  data: [
    "src/lib/extensionCapabilities.ts",
    "src/routers/extensionProcedures.ts",
  ],
  localization: [
    "src/lib/extensionCapabilities.ts",
    "src/routers/extensionProcedures.ts",
  ],
  collab: [
    "src/lib/extensionCapabilities.ts",
    "src/routers/extensionProcedures.ts",
  ],
};

const DOMAIN_SECURITY_NOTES: Partial<Record<BuildCapabilityId, string[]>> = {
  music: [
    "Only licensed, owned, or otherwise lawful audio material may be ingested",
  ],
  patent: [
    "Prior-art workflow and drafting scaffolds do not guarantee patentability; qualified review is required",
  ],
  architecture: [
    "Regulated professional documents require qualified licensed professional review",
  ],
  legal: [
    "Legal scaffolds are editable engineering resources, not a substitute for qualified legal review",
  ],
  fintech: [
    "Financial and regulatory obligations require qualified review for the target jurisdiction",
  ],
  healthcare: [
    "Sensitive-data scaffolds are not by themselves a legal compliance certification",
  ],
  voice: [
    "Background/wake behavior must respect target-platform rules and user privacy",
  ],
};

function domainResource(
  capability: BuildCapabilityId,
): BuilderResourceManifest {
  return parseBuilderResourceManifest({
    identity: {
      resourceId: `domain.${capability}.contract-pack`,
      name: `${capability} reusable domain contract pack`,
      category: capability,
      resourceType: "domain_pack",
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
      capabilitiesProvided: [capability],
      optionalCapabilities: [],
      dependencies: [],
      integrationPoints: [capability],
    },
    contracts: {
      inputContract: { kind: `${capability}-domain-input` },
      outputContract: { kind: `${capability}-validated-domain-model` },
      apiContract: null,
      dataContract: {
        schemaExport: `CAPABILITY_DOMAIN_CONTRACTS.${capability}`,
        featurePackExport: `DOMAIN_FEATURE_CONTRACTS.${capability}`,
        runtimeBuildingBlocks: "domainRuntimeResources",
      },
      eventsEmitted: [],
      eventsConsumed: [],
      requiredEnvironmentVariables: [],
      secretRequirements: [],
    },
    adaptation: {
      configurableFields: [`${capability}.configuration`],
      replacementPoints: [],
      brandingHooks:
        capability === "graphics" || capability === "marketing"
          ? [`${capability}.branding`]
          : [],
      localizationHooks: ["locale"],
      authorizationHooks: ["authorization.policy"],
      databaseHooks: ["database.mapping"],
      extensionPoints: [`${capability}.extensions`],
    },
    composition: {
      routes: [],
      databaseMigrations: [],
      environmentVariables: [],
      packages: {},
      stateNamespaces: [],
      navigationKeys: [],
      permissions:
        capability === "ar"
          ? ["camera"]
          : capability === "voice"
            ? ["microphone"]
            : [],
      stylingTokens: capability === "graphics" ? ["design.tokens"] : [],
      platformCapabilities: capability === "ar" ? ["camera", "webxr"] : [],
      deploymentRequirements: [],
    },
    implementation: {
      sourcePaths: [
        "src/lib/builderResources/domainRuntimeResources.ts",
        "src/lib/builderResources/domainResourceContracts.ts",
        "src/lib/builderResources/domainFeatureContracts.ts",
        ...EXISTING_DOMAIN_SOURCES[capability],
      ],
      testPaths: [
        "src/lib/builderResources/__tests__/domainRuntimeResources.test.ts",
        "src/lib/builderResources/__tests__/domainResourceContracts.test.ts",
        "src/lib/builderResources/__tests__/domainFeatureContracts.test.ts",
      ],
      exportPolicy: "compose",
      requiresLiveLibraryAtRuntime: false,
    },
    evidence: {
      unitTests: [
        "src/lib/builderResources/__tests__/domainRuntimeResources.test.ts",
        "src/lib/builderResources/__tests__/domainResourceContracts.test.ts",
        "src/lib/builderResources/__tests__/domainFeatureContracts.test.ts",
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
      adapterEvidence: {
        discovered: true,
        installVerified: true,
      },
    },
    governance: {
      provenance:
        "AppForge-owned reusable runtime/domain contracts plus existing capability implementation",
      license: "UNLICENSED-INTERNAL",
      allowedUse: ["internal-generation"],
      securityNotes: DOMAIN_SECURITY_NOTES[capability] ?? [],
      deprecationStatus: "active",
      replacementResourceId: null,
      maintainerInternalOwner: "appforge",
      maturityState: "structural",
      quarantine: null,
    },
  });
}

export const SUBSTANTIAL_DOMAIN_RESOURCES =
  BUILD_CAPABILITY_IDS.map(domainResource);
