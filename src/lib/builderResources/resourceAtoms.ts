import { z } from "zod";
import {
  parseBuilderResourceManifest,
  type BuilderResourceManifest,
} from "./resourceManifest.js";

export const validatedFieldAtomSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "email", "password", "number", "date", "time", "search"]),
  required: z.boolean(),
  minLength: z.number().int().nonnegative().optional(),
  maxLength: z.number().int().positive().optional(),
  pattern: z.string().optional(),
  autocomplete: z.string().optional(),
  accessibleDescription: z.string().optional(),
});

export const asyncStateAtomSchema = z.object({
  state: z.enum(["idle", "loading", "empty", "success", "error"]),
  message: z.string().optional(),
  retryable: z.boolean().default(false),
});

export const dateRangeAtomSchema = z
  .object({
    start: z.string().datetime(),
    end: z.string().datetime(),
    timezone: z.string().min(1),
  })
  .refine((value) => Date.parse(value.end) >= Date.parse(value.start), {
    message: "Date range end must be at or after start",
  });

export const notificationTokenAtomSchema = z.object({
  ownerId: z.string().min(1),
  platform: z.enum(["ios", "android", "web"]),
  token: z.string().min(1),
  createdAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable(),
});

export const apiValidationAtomSchema = z.object({
  correlationId: z.string().min(1),
  ok: z.boolean(),
  status: z.number().int().min(100).max(599),
  errorCode: z.string().nullable(),
  safeMessage: z.string(),
});

export const modalAtomSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  dismissible: z.boolean(),
  destructive: z.boolean(),
  initialFocusTarget: z.string().min(1),
  returnFocusTarget: z.string().min(1),
});

export const listItemAtomSchema = z.object({
  id: z.string().min(1),
  primary: z.string().min(1),
  secondary: z.string().optional(),
  actionLabel: z.string().optional(),
  selected: z.boolean().default(false),
});

export const chartWrapperAtomSchema = z.object({
  chartId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  dataTableFallback: z.boolean(),
  accessibleSummary: z.string().min(1),
});

export const BUILDER_RESOURCE_ATOM_SCHEMAS = {
  "validated-field": validatedFieldAtomSchema,
  "async-state": asyncStateAtomSchema,
  "date-range": dateRangeAtomSchema,
  "notification-token": notificationTokenAtomSchema,
  "api-validation": apiValidationAtomSchema,
  modal: modalAtomSchema,
  "list-item": listItemAtomSchema,
  "chart-wrapper": chartWrapperAtomSchema,
} as const;

export const BUILDER_RESOURCE_ATOMS: BuilderResourceManifest[] = Object.keys(
  BUILDER_RESOURCE_ATOM_SCHEMAS,
).map((atomId) =>
  parseBuilderResourceManifest({
    identity: {
      resourceId: `atom.${atomId}`,
      name: atomId
        .split("-")
        .map((part) => part[0]?.toUpperCase() + part.slice(1))
        .join(" "),
      category: "core",
      resourceType: "atom",
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
      dependencies: [],
      integrationPoints: [atomId],
    },
    contracts: {
      inputContract: { schema: `BUILDER_RESOURCE_ATOM_SCHEMAS.${atomId}` },
      outputContract: { kind: "validated-atom-state" },
      apiContract: null,
      dataContract: null,
      eventsEmitted: [],
      eventsConsumed: [],
      requiredEnvironmentVariables: [],
      secretRequirements: [],
    },
    adaptation: {
      configurableFields: [`${atomId}.configuration`],
      replacementPoints: [],
      brandingHooks: ["design.tokens"],
      localizationHooks: ["locale"],
      authorizationHooks: [],
      databaseHooks: [],
      extensionPoints: [],
    },
    evidence: {
      unitTests: ["src/lib/builderResources/__tests__/resourceLevels.test.ts"],
      integrationTests: [],
      behavioralTests: [],
      buildEvidence: [],
      runtimeEvidence: [],
      securityEvidence: [],
      accessibilityEvidence: ["atom-contract-accessibility-fields"],
      performanceEvidence: [],
      reproducibilityEvidence: [],
      lastVerifiedAt: null,
      evidenceLedgerIds: [],
      adapterEvidence: { discovered: true, installVerified: true },
    },
    governance: {
      provenance: "AppForge-owned reusable atom contract",
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
      sourcePaths: ["src/lib/builderResources/resourceAtoms.ts"],
      testPaths: ["src/lib/builderResources/__tests__/resourceLevels.test.ts"],
      exportPolicy: "copy-adapt",
      requiresLiveLibraryAtRuntime: false,
    },
  }),
);
