import type { AdapterCapabilityState } from "../adapterSdk.js";
import type { ProductType } from "../productContract.js";
import type { BuilderResourceCapabilityId } from "./resourceCapabilities.js";
import {
  parseBuilderResourceManifest,
  type BuilderResourceManifest,
  type BuilderResourceType,
} from "./resourceManifest.js";
import { BuilderResourceRegistry } from "./resourceRegistry.js";

type BuiltinResourceDefinition = {
  resourceId: string;
  name: string;
  category: string;
  resourceType?: BuilderResourceType;
  capabilities: BuilderResourceCapabilityId[];
  optionalCapabilities?: BuilderResourceCapabilityId[];
  integrations?: string[];
  dependencies?: string[];
  sourcePaths: string[];
  testPaths?: string[];
  productTypes?: Array<ProductType | "*">;
  stacks?: string[];
  runtimes?: string[];
  platforms?: string[];
  configurableFields?: string[];
  brandingHooks?: string[];
  localizationHooks?: string[];
  authorizationHooks?: string[];
  databaseHooks?: string[];
  extensionPoints?: string[];
  routes?: string[];
  migrations?: string[];
  environmentVariables?: string[];
  packages?: Record<string, string>;
  permissions?: string[];
  platformCapabilities?: string[];
  deploymentRequirements?: string[];
  maturity?: AdapterCapabilityState;
  securityNotes?: string[];
};

const BASE_VERIFIED_AT = "2026-10-15T21:27:02.000Z";

function builtin(definition: BuiltinResourceDefinition): BuilderResourceManifest {
  const maturity = definition.maturity ?? "structural";
  return parseBuilderResourceManifest({
    identity: {
      resourceId: definition.resourceId,
      name: definition.name,
      category: definition.category,
      resourceType: definition.resourceType ?? "module",
      version: "1.0.0",
    },
    compatibility: {
      supportedProductTypes: definition.productTypes ?? ["*"],
      supportedTechnologyStacks: definition.stacks ?? ["*"],
      supportedRuntimes: definition.runtimes ?? ["*"],
      supportedPlatforms: definition.platforms ?? ["*"],
      incompatibleCombinations: [],
      minimumRuntimeToolVersions: {},
    },
    capabilities: {
      capabilitiesProvided: definition.capabilities,
      optionalCapabilities: definition.optionalCapabilities ?? [],
      dependencies: definition.dependencies ?? [],
      integrationPoints: definition.integrations ?? [],
    },
    contracts: {
      inputContract: { kind: "ProductContract/ProductPlan-driven" },
      outputContract: { kind: "exportable generated product files" },
      apiContract: null,
      dataContract: null,
      eventsEmitted: [],
      eventsConsumed: [],
      requiredEnvironmentVariables: definition.environmentVariables ?? [],
      secretRequirements: (definition.environmentVariables ?? []).filter((key) =>
        /(?:secret|token|key|password)/i.test(key),
      ),
    },
    adaptation: {
      configurableFields: definition.configurableFields ?? [],
      replacementPoints: [],
      brandingHooks: definition.brandingHooks ?? [],
      localizationHooks: definition.localizationHooks ?? [],
      authorizationHooks: definition.authorizationHooks ?? [],
      databaseHooks: definition.databaseHooks ?? [],
      extensionPoints: definition.extensionPoints ?? [],
    },
    composition: {
      routes: definition.routes ?? [],
      databaseMigrations: definition.migrations ?? [],
      environmentVariables: definition.environmentVariables ?? [],
      packages: definition.packages ?? {},
      stateNamespaces: [],
      navigationKeys: [],
      permissions: definition.permissions ?? [],
      stylingTokens: [],
      platformCapabilities: definition.platformCapabilities ?? [],
      deploymentRequirements: definition.deploymentRequirements ?? [],
    },
    implementation: {
      sourcePaths: definition.sourcePaths,
      testPaths: definition.testPaths ?? [],
      exportPolicy: "compose",
      requiresLiveLibraryAtRuntime: false,
    },
    evidence: {
      unitTests: definition.testPaths ?? [],
      integrationTests: [],
      behavioralTests: [],
      buildEvidence: [],
      runtimeEvidence: [],
      securityEvidence: [],
      accessibilityEvidence: [],
      performanceEvidence: [],
      reproducibilityEvidence: [],
      lastVerifiedAt: BASE_VERIFIED_AT,
      evidenceLedgerIds: ["baseline-pr-192"],
      adapterEvidence: {
        discovered: true,
        installVerified: maturity === "structural" || maturity === "experimental",
        evidenceLedgerIds: ["baseline-pr-192"],
      },
    },
    governance: {
      provenance: "AppForge repository-owned source",
      license: "UNLICENSED-INTERNAL",
      allowedUse: ["internal-generation"],
      securityNotes: definition.securityNotes ?? [],
      deprecationStatus: "active",
      replacementResourceId: null,
      maintainerInternalOwner: "appforge",
      maturityState: maturity,
      quarantine: null,
    },
  });
}

const CORE_RESOURCES: BuilderResourceManifest[] = [
  builtin({
    resourceId: "core.authentication",
    name: "Authentication and session lifecycle",
    category: "core",
    capabilities: ["authentication", "authorization"],
    sourcePaths: [
      "src/lib/auth.ts",
      "src/pages/Login.tsx",
      "src/pages/Signup.tsx",
      "src/pages/PasswordReset.tsx",
      "src/pages/ResendVerification.tsx",
      "src/lib/codeGeneration.ts",
    ],
    testPaths: ["src/__tests__/customer-flow-contract.e2e.spec.ts"],
    integrations: ["authentication"],
    configurableFields: ["auth.providers", "auth.requireEmailVerification"],
    authorizationHooks: ["auth.roles", "auth.ownerPolicy"],
    databaseHooks: ["auth.userProfile"],
  }),
  builtin({
    resourceId: "core.account",
    name: "Account and profile management",
    category: "core",
    capabilities: ["account", "authentication"],
    dependencies: ["core.authentication"],
    sourcePaths: ["src/pages/Account.tsx", "src/lib/codeGeneration.ts"],
    configurableFields: ["account.profileFields", "account.preferences"],
    localizationHooks: ["account.labels"],
    authorizationHooks: ["account.ownerPolicy"],
  }),
  builtin({
    resourceId: "core.database",
    name: "Database persistence and migration boundaries",
    category: "core",
    capabilities: ["database"],
    sourcePaths: [
      "src/db/schema.ts",
      "src/db/ensureSchema.ts",
      "src/lib/databasePersistence.ts",
      "src/lib/codeGeneration.ts",
    ],
    databaseHooks: ["database.schema", "database.ownership", "database.rls"],
  }),
  builtin({
    resourceId: "core.api",
    name: "Validated API and error boundary",
    category: "core",
    capabilities: ["api", "security"],
    sourcePaths: ["src/utils/trpc.ts", "src/routes/generate.ts", "src/lib/codeGeneration.ts"],
    configurableFields: ["api.rateLimits", "api.validation"],
    authorizationHooks: ["api.authMiddleware"],
  }),
  builtin({
    resourceId: "core.storage",
    name: "Upload and storage boundary",
    category: "core",
    capabilities: ["storage", "security"],
    sourcePaths: ["src/lib/codeGeneration.ts"],
    configurableFields: ["storage.mimeTypes", "storage.maxBytes"],
    authorizationHooks: ["storage.ownerPolicy"],
    extensionPoints: ["storage.provider"],
  }),
  builtin({
    resourceId: "core.notifications",
    name: "Notification delivery abstraction",
    category: "core",
    capabilities: ["notifications", "mobile"],
    sourcePaths: ["src/lib/codeGeneration.ts", "src/lib/productCapabilityAdapters.ts"],
    configurableFields: ["notifications.channels", "notifications.preferences"],
    extensionPoints: ["notifications.provider"],
    platformCapabilities: ["push-notifications", "local-notifications"],
  }),
  builtin({
    resourceId: "core.billing",
    name: "Billing, entitlements and credits",
    category: "core",
    capabilities: ["billing", "monetization", "fintech"],
    sourcePaths: [
      "src/services/stripeCheckout.ts",
      "src/webhooks/stripe.ts",
      "src/lib/codeGeneration.ts",
    ],
    testPaths: [
      "src/__tests__/canonicalCheckout.test.ts",
      "src/__tests__/stripeDelayedEvents.test.ts",
    ],
    integrations: ["stripe"],
    environmentVariables: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    routes: ["POST /checkout", "POST /webhooks/stripe"],
    extensionPoints: ["billing.provider"],
  }),
  builtin({
    resourceId: "core.webhooks",
    name: "Verified idempotent webhook processing",
    category: "core",
    capabilities: ["webhooks", "security"],
    sourcePaths: ["src/webhooks/stripe.ts", "src/lib/codeGeneration.ts"],
    configurableFields: ["webhooks.allowedEvents", "webhooks.retryPolicy"],
    authorizationHooks: ["webhooks.signatureVerification"],
  }),
  builtin({
    resourceId: "core.background-jobs",
    name: "Background jobs, retries and schedules",
    category: "core",
    capabilities: ["background_jobs"],
    sourcePaths: ["src/services/build-worker.ts", "src/lib/codeGeneration.ts"],
    configurableFields: ["jobs.retryPolicy", "jobs.schedule"],
    extensionPoints: ["jobs.queueProvider"],
  }),
  builtin({
    resourceId: "core.search",
    name: "Search and filtering foundation",
    category: "core",
    capabilities: ["search", "data"],
    sourcePaths: ["src/services/webSearch.ts"],
    configurableFields: ["search.fields", "search.filters"],
    extensionPoints: ["search.provider"],
  }),
  builtin({
    resourceId: "core.analytics",
    name: "Analytics event and dashboard foundation",
    category: "core",
    capabilities: ["analytics", "data"],
    sourcePaths: ["src/lib/buildCapabilities.ts", "src/agents/capabilityHints.ts"],
    configurableFields: ["analytics.events", "analytics.consent"],
    extensionPoints: ["analytics.provider"],
  }),
  builtin({
    resourceId: "core.security",
    name: "Security validation and authorization guardrails",
    category: "core",
    capabilities: ["security", "authorization"],
    sourcePaths: ["src/agents/buildValidator.ts", "src/lib/productCapabilityAdapters.ts"],
    configurableFields: ["security.rateLimits", "security.uploadPolicy"],
    authorizationHooks: ["security.roles", "security.ownership"],
  }),
  builtin({
    resourceId: "core.observability",
    name: "Logging, health and error reporting foundation",
    category: "core",
    capabilities: ["observability"],
    sourcePaths: ["src/_core/logger.ts", "src/services/deployHealth.ts"],
    configurableFields: ["observability.logLevel", "observability.redaction"],
    extensionPoints: ["observability.errorProvider"],
  }),
];

const DESIGN_RESOURCES: BuilderResourceManifest[] = [
  builtin({
    resourceId: "design.controls",
    name: "Accessible controls family",
    category: "graphics",
    resourceType: "component",
    capabilities: ["graphics"],
    sourcePaths: [
      "src/design-system/Button.tsx",
      "src/design-system/Input.tsx",
      "src/design-system/Badge.tsx",
    ],
    testPaths: ["src/design-system/__tests__"],
    stacks: ["react-node", "next-node", "*"],
    runtimes: ["react", "browser"],
    platforms: ["web", "desktop", "*"],
    configurableFields: ["design.size", "design.variant"],
    brandingHooks: ["design.tokens"],
    localizationHooks: ["design.labels"],
  }),
  builtin({
    resourceId: "design.layout",
    name: "Responsive section and card layouts",
    category: "graphics",
    resourceType: "component",
    capabilities: ["graphics"],
    sourcePaths: ["src/design-system/Section.tsx", "src/design-system/GlassCard.tsx"],
    stacks: ["react-node", "next-node", "*"],
    configurableFields: ["layout.density", "layout.breakpoints"],
    brandingHooks: ["layout.surfaceTokens"],
  }),
];

const CAPABILITY_RESOURCES: BuilderResourceManifest[] = [
  builtin({
    resourceId: "capability.web-search",
    name: "Evidence-backed live research",
    category: "web_search",
    capabilities: ["web_search"],
    sourcePaths: [
      "src/services/webSearch.ts",
      "src/agents/researchAgent.ts",
      "src/lib/researchEvidence.ts",
      "src/lib/researchQueries.ts",
    ],
    testPaths: ["src/__tests__/researchEvidence.test.ts"],
    configurableFields: ["research.authorityPolicy", "research.maxAgeDays"],
  }),
  builtin({
    resourceId: "capability.video",
    name: "Video storyboard and timeline studio",
    category: "video",
    capabilities: ["video"],
    sourcePaths: ["src/pages/VideoStudio.tsx", "src/agents/capabilityHints.ts"],
    configurableFields: ["video.aspectRatio", "video.captionPolicy"],
  }),
  builtin({
    resourceId: "capability.graphics",
    name: "Graphics editor and asset pipeline",
    category: "graphics",
    capabilities: ["graphics"],
    sourcePaths: ["src/pages/GraphicsEditor.tsx", "src/lib/graphicsEditorTypes.ts"],
    configurableFields: ["graphics.designFamily", "graphics.assetPolicy"],
    brandingHooks: ["graphics.brandTokens"],
  }),
  builtin({
    resourceId: "capability.music",
    name: "Music and audio studio",
    category: "music",
    capabilities: ["music"],
    sourcePaths: ["src/pages/MusicStudio.tsx", "src/agents/capabilityHints.ts"],
    configurableFields: ["audio.bpm", "audio.key", "audio.transcript"],
  }),
  builtin({
    resourceId: "capability.marketing",
    name: "Marketing and conversion architecture",
    category: "marketing",
    capabilities: ["marketing", "analytics"],
    sourcePaths: ["src/pages/MarketingStudio.tsx", "src/agents/capabilityHints.ts"],
    configurableFields: ["marketing.funnel", "marketing.attribution"],
    brandingHooks: ["marketing.brand"],
  }),
  builtin({
    resourceId: "capability.ar",
    name: "AR/WebXR experience foundation",
    category: "ar",
    capabilities: ["ar"],
    sourcePaths: ["src/pages/ARStudio.tsx", "src/agents/capabilityHints.ts"],
    configurableFields: ["ar.scene", "ar.fallback"],
    permissions: ["camera"],
    platformCapabilities: ["camera", "webxr"],
  }),
  builtin({
    resourceId: "capability.education",
    name: "Education and LMS domain foundation",
    category: "education",
    capabilities: ["education", "notifications"],
    sourcePaths: ["src/pages/EducationStudio.tsx", "src/agents/capabilityHints.ts"],
    configurableFields: ["education.roles", "education.assessmentPolicy"],
    localizationHooks: ["education.curriculumLocale"],
  }),
  builtin({
    resourceId: "capability.patent",
    name: "Invention and patent workspace",
    category: "patent",
    capabilities: ["patent", "web_search"],
    sourcePaths: ["src/pages/PatentStudio.tsx", "src/agents/capabilityHints.ts"],
    configurableFields: ["patent.jurisdiction", "patent.reviewCheckpoints"],
    securityNotes: ["Attorney review required; no patentability guarantee"],
  }),
  builtin({
    resourceId: "capability.architecture",
    name: "Architecture and BIM workflow foundation",
    category: "architecture",
    capabilities: ["architecture", "cad"],
    sourcePaths: [
      "src/pages/ArchitectureStudio.tsx",
      "src/lib/architectureProcedures.ts",
      "src/agents/capabilityHints.ts",
    ],
    configurableFields: ["architecture.jurisdiction", "architecture.units"],
    securityNotes: ["Licensed professional review required for regulated documentation"],
  }),
  ...(
    [
      "game",
      "cad",
      "legal",
      "fintech",
      "healthcare",
      "mobile",
      "voice",
      "data",
      "localization",
      "collab",
    ] as const
  ).map((category) =>
    builtin({
      resourceId: `capability.${category}`,
      name: `${category} reusable domain foundation`,
      category,
      capabilities: [category],
      sourcePaths: [
        "src/lib/extensionCapabilities.ts",
        "src/routers/extensionProcedures.ts",
        "src/pages/ExtensionStudio.tsx",
        "src/agents/capabilityHints.ts",
      ],
      configurableFields: [`${category}.configuration`],
      extensionPoints: [`${category}.provider`],
      securityNotes:
        category === "legal"
          ? ["Qualified legal review required"]
          : category === "healthcare"
            ? ["Generated scaffolding is not compliance certification"]
            : category === "fintech"
              ? ["Financial/regulatory review may be required"]
              : [],
    }),
  ),
];

export const BUILTIN_BUILDER_RESOURCES: BuilderResourceManifest[] = [
  ...CORE_RESOURCES,
  ...DESIGN_RESOURCES,
  ...CAPABILITY_RESOURCES,
];

export function createBuiltinBuilderResourceRegistry(): BuilderResourceRegistry {
  return new BuilderResourceRegistry(BUILTIN_BUILDER_RESOURCES);
}

export function builtinResourceCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const resource of BUILTIN_BUILDER_RESOURCES) {
    counts[resource.identity.category] = (counts[resource.identity.category] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)),
  );
}
