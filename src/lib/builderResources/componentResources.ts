import { z } from "zod";
import {
  parseBuilderResourceManifest,
  type BuilderResourceManifest,
} from "./resourceManifest.js";

export const reusableComponentSchema = z.object({
  componentId: z.string().min(1),
  purpose: z.string().min(1),
  inputs: z.array(z.string().min(1)),
  outputs: z.array(z.string().min(1)),
  asyncStates: z.array(z.enum(["loading", "empty", "success", "error"])),
  accessibility: z.array(z.string().min(1)),
  adaptationPoints: z.array(z.string().min(1)),
});

export const REUSABLE_COMPONENT_CONTRACTS = [
  {
    componentId: "login-form",
    purpose:
      "Validated authentication form with error, loading and password visibility behavior.",
    inputs: ["identifier", "password", "providerOptions"],
    outputs: ["authenticated-session", "auth-error"],
    asyncStates: ["loading", "success", "error"] as const,
    accessibility: ["labels", "error-association", "keyboard-submit"],
    adaptationPoints: ["fields", "providers", "branding", "localization"],
    sourcePaths: ["src/pages/Login.tsx"],
    capabilities: ["authentication"] as const,
  },
  {
    componentId: "profile-editor",
    purpose:
      "Owner-scoped account profile editor with validation and persistence state.",
    inputs: ["profile", "editableFields"],
    outputs: ["updated-profile", "validation-error"],
    asyncStates: ["loading", "empty", "success", "error"] as const,
    accessibility: ["labels", "status-announcement"],
    adaptationPoints: ["fields", "validation", "permissions", "localization"],
    sourcePaths: ["src/pages/Account.tsx"],
    capabilities: ["account"] as const,
  },
  {
    componentId: "pricing-card",
    purpose:
      "Plan and one-time purchase presentation wired to a server checkout boundary.",
    inputs: ["product", "price", "entitlementSummary"],
    outputs: ["checkout-request"],
    asyncStates: ["loading", "success", "error"] as const,
    accessibility: ["semantic-price", "button-label"],
    adaptationPoints: ["billingModel", "currency", "branding", "localization"],
    sourcePaths: ["src/pages/Pricing.tsx"],
    capabilities: ["billing", "monetization"] as const,
  },
  {
    componentId: "search-box",
    purpose:
      "Debounced accessible search input with filters and explicit result state.",
    inputs: ["query", "filters", "minimumLength"],
    outputs: ["search-request", "clear-request"],
    asyncStates: ["loading", "empty", "success", "error"] as const,
    accessibility: ["search-role", "result-count-announcement"],
    adaptationPoints: ["fields", "filters", "provider", "localization"],
    sourcePaths: ["src/services/webSearch.ts"],
    capabilities: ["search"] as const,
  },
  {
    componentId: "file-uploader",
    purpose:
      "Validated file selection/upload component respecting MIME, size and ownership policies.",
    inputs: ["allowedMimeTypes", "maxBytes", "multiple"],
    outputs: ["upload-request", "validation-error", "delete-request"],
    asyncStates: ["loading", "empty", "success", "error"] as const,
    accessibility: ["keyboard-picker", "progress-announcement"],
    adaptationPoints: ["mimeTypes", "size", "storageProvider", "authorization"],
    sourcePaths: ["src/lib/codeGeneration.ts"],
    capabilities: ["storage"] as const,
  },
  {
    componentId: "data-table",
    purpose:
      "Accessible sortable/filterable/paginated table with row actions and ownership hooks.",
    inputs: ["columns", "rows", "sort", "filters", "pagination"],
    outputs: ["sort-change", "filter-change", "page-change", "row-action"],
    asyncStates: ["loading", "empty", "success", "error"] as const,
    accessibility: ["caption", "column-headers", "keyboard-row-actions"],
    adaptationPoints: ["columns", "rowActions", "permissions", "localization"],
    sourcePaths: ["src/design-system/Section.tsx"],
    capabilities: ["data"] as const,
  },
  {
    componentId: "booking-selector",
    purpose:
      "Generic resource/date/time/party or quantity selection component adaptable across booking domains.",
    inputs: ["resource", "dateRange", "timeRange", "quantity"],
    outputs: ["booking-preference"],
    asyncStates: ["loading", "empty", "success", "error"] as const,
    accessibility: ["date-labels", "time-labels", "validation-summary"],
    adaptationPoints: [
      "resourceVocabulary",
      "constraints",
      "timezone",
      "localization",
    ],
    sourcePaths: ["src/lib/codeGeneration.ts"],
    capabilities: ["database"] as const,
  },
  {
    componentId: "data-chart",
    purpose:
      "Chart wrapper requiring accessible summary and data-table fallback.",
    inputs: ["series", "axes", "formatters"],
    outputs: ["selection", "filter-request"],
    asyncStates: ["loading", "empty", "success", "error"] as const,
    accessibility: ["summary", "table-fallback", "non-color-encoding"],
    adaptationPoints: ["chartType", "series", "formatting", "branding"],
    sourcePaths: ["src/pages/ExtensionStudio.tsx"],
    capabilities: ["data", "graphics"] as const,
  },
].map((definition) => ({
  ...definition,
  contract: reusableComponentSchema.parse(definition),
}));

export const COMPONENT_RESOURCES: BuilderResourceManifest[] =
  REUSABLE_COMPONENT_CONTRACTS.map(({ sourcePaths, capabilities, contract }) =>
    parseBuilderResourceManifest({
      identity: {
        resourceId: `component.${contract.componentId}`,
        name: contract.componentId
          .split("-")
          .map((part) => part[0]?.toUpperCase() + part.slice(1))
          .join(" "),
        category: "core",
        resourceType: "component",
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
        capabilitiesProvided: [...capabilities],
        optionalCapabilities: [],
        dependencies: [],
        integrationPoints: [contract.componentId],
      },
      contracts: {
        inputContract: { fields: contract.inputs },
        outputContract: { events: contract.outputs },
        apiContract: null,
        dataContract: { component: contract },
        eventsEmitted: [...contract.outputs],
        eventsConsumed: [],
        requiredEnvironmentVariables: [],
        secretRequirements: [],
      },
      adaptation: {
        configurableFields: [...contract.adaptationPoints],
        replacementPoints: [],
        brandingHooks: contract.adaptationPoints.includes("branding")
          ? ["branding"]
          : [],
        localizationHooks: contract.adaptationPoints.includes("localization")
          ? ["localization"]
          : [],
        authorizationHooks:
          contract.adaptationPoints.includes("permissions") ||
          contract.adaptationPoints.includes("authorization")
            ? ["authorization"]
            : [],
        databaseHooks: [],
        extensionPoints: [],
      },
      evidence: {
        unitTests: [
          "src/lib/builderResources/__tests__/resourceLevels.test.ts",
        ],
        integrationTests: [],
        behavioralTests: [],
        buildEvidence: [],
        runtimeEvidence: [],
        securityEvidence: [],
        accessibilityEvidence: contract.accessibility,
        performanceEvidence: [],
        reproducibilityEvidence: [],
        lastVerifiedAt: null,
        evidenceLedgerIds: [],
        adapterEvidence: { discovered: true, installVerified: true },
      },
      governance: {
        provenance: "AppForge-owned reusable component contract",
        license: "UNLICENSED-INTERNAL",
        allowedUse: ["internal-generation"],
        securityNotes: [],
        deprecationStatus: "active",
        replacementResourceId: null,
        maintainerInternalOwner: "appforge",
        maturityState: "structural",
        quarantine: null,
      },
      implementation: {
        sourcePaths: [
          "src/lib/builderResources/componentResources.ts",
          ...sourcePaths,
        ],
        testPaths: [
          "src/lib/builderResources/__tests__/resourceLevels.test.ts",
        ],
        exportPolicy: "copy-adapt",
        requiresLiveLibraryAtRuntime: false,
      },
    }),
  );
