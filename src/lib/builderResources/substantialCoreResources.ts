import {
  CORE_BUILDER_RESOURCE_CAPABILITY_IDS,
  type CoreBuilderResourceCapabilityId,
} from "./resourceCapabilities.js";
import {
  parseBuilderResourceManifest,
  type BuilderResourceManifest,
} from "./resourceManifest.js";

const SOURCE_MAP: Record<CoreBuilderResourceCapabilityId, string[]> = {
  authentication: ["src/lib/auth.ts", "src/lib/codeGeneration.ts"],
  account: ["src/pages/Account.tsx", "src/lib/codeGeneration.ts"],
  authorization: ["src/lib/agentCoordination.ts", "src/lib/codeGeneration.ts"],
  database: ["src/db/schema.ts", "src/lib/databasePersistence.ts"],
  api: ["src/utils/trpc.ts", "src/routes/generate.ts"],
  storage: ["src/lib/codeGeneration.ts"],
  notifications: [
    "src/lib/codeGeneration.ts",
    "src/lib/productCapabilityAdapters.ts",
  ],
  billing: [
    "src/services/stripeCheckout.ts",
    "src/webhooks/stripe.ts",
    "src/lib/codeGeneration.ts",
  ],
  webhooks: ["src/webhooks/stripe.ts", "src/lib/codeGeneration.ts"],
  background_jobs: [
    "src/services/build-worker.ts",
    "src/lib/codeGeneration.ts",
  ],
  search: ["src/services/webSearch.ts"],
  analytics: ["src/lib/buildCapabilities.ts", "src/agents/capabilityHints.ts"],
  security: [
    "src/agents/buildValidator.ts",
    "src/lib/productCapabilityAdapters.ts",
  ],
  observability: ["src/_core/logger.ts", "src/services/deployHealth.ts"],
  monetization: [
    "src/services/stripeCheckout.ts",
    "src/webhooks/stripe.ts",
    "src/lib/codeGeneration.ts",
  ],
};

function resourceId(capability: CoreBuilderResourceCapabilityId): string {
  return capability === "authorization"
    ? "core.authorization"
    : `corepack.${capability}.contract`;
}

function corePack(
  capability: CoreBuilderResourceCapabilityId,
): BuilderResourceManifest {
  return parseBuilderResourceManifest({
    identity: {
      resourceId: resourceId(capability),
      name: `${capability} reusable core contract pack`,
      category: "core",
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
      capabilitiesProvided: [capability],
      optionalCapabilities: [],
      dependencies: capability === "account" ? ["core.authentication"] : [],
      integrationPoints: [capability],
    },
    contracts: {
      inputContract: { kind: `${capability}-configuration` },
      outputContract: { kind: `${capability}-validated-contract` },
      apiContract: null,
      dataContract: { schemaExport: `CORE_RESOURCE_CONTRACTS.${capability}` },
      eventsEmitted: [],
      eventsConsumed: [],
      requiredEnvironmentVariables: [],
      secretRequirements: [],
    },
    adaptation: {
      configurableFields: [`${capability}.configuration`],
      replacementPoints: [],
      brandingHooks: [],
      localizationHooks: ["locale"],
      authorizationHooks: ["authorization.policy"],
      databaseHooks: ["database.mapping"],
      extensionPoints: [`${capability}.provider`],
    },
    composition: {
      routes: [],
      databaseMigrations: [],
      environmentVariables: [],
      packages: {},
      stateNamespaces: [],
      navigationKeys: [],
      permissions: [],
      stylingTokens: [],
      platformCapabilities: [],
      deploymentRequirements: [],
    },
    implementation: {
      sourcePaths: [
        "src/lib/builderResources/coreResourceContracts.ts",
        ...SOURCE_MAP[capability],
      ],
      testPaths: [
        "src/lib/builderResources/__tests__/coreResourceContracts.test.ts",
      ],
      exportPolicy: "compose",
      requiresLiveLibraryAtRuntime: false,
    },
    evidence: {
      unitTests: [
        "src/lib/builderResources/__tests__/coreResourceContracts.test.ts",
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
        "AppForge-owned reusable core contract plus existing repository implementation",
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

export const SUBSTANTIAL_CORE_RESOURCES =
  CORE_BUILDER_RESOURCE_CAPABILITY_IDS.map(corePack);
