import { z } from "zod";
import {
  ADAPTER_CAPABILITY_STATES,
  evaluateAdapterPromotion,
  type AdapterCapabilityState,
  type AdapterEvidence,
} from "../adapterSdk.js";
import {
  BUILDER_RESOURCE_CAPABILITY_IDS,
  type BuilderResourceCapabilityId,
} from "./resourceCapabilities.js";

export const BUILDER_RESOURCE_TYPES = [
  "atom",
  "component",
  "module",
  "domain_pack",
  "reference_architecture",
] as const;

export type BuilderResourceType = (typeof BUILDER_RESOURCE_TYPES)[number];

const nonEmptyString = z.string().trim().min(1);
const stringList = z.array(nonEmptyString);
const nullableJsonContract = z.record(z.unknown()).nullable();

const adapterEvidenceSchema = z.object({
  discovered: z.boolean().optional(),
  installVerified: z.boolean().optional(),
  compileOrBuildVerified: z.boolean().optional(),
  testsVerified: z.boolean().optional(),
  runtimeVerified: z.boolean().optional(),
  packageVerified: z.boolean().optional(),
  deploymentVerified: z.boolean().optional(),
  securityScanVerified: z.boolean().optional(),
  behavioralVerified: z.boolean().optional(),
  reproducibleBuild: z.boolean().optional(),
  evidenceLedgerIds: stringList.optional(),
});

export const builderResourceCompositionSchema = z.object({
  routes: stringList,
  databaseMigrations: stringList,
  environmentVariables: stringList,
  packages: z.record(nonEmptyString),
  stateNamespaces: stringList,
  navigationKeys: stringList,
  permissions: stringList,
  stylingTokens: stringList,
  platformCapabilities: stringList,
  deploymentRequirements: stringList,
});

export const builderResourceManifestSchema = z.object({
  identity: z.object({
    resourceId: nonEmptyString,
    name: nonEmptyString,
    category: nonEmptyString,
    resourceType: z.enum(BUILDER_RESOURCE_TYPES),
    version: nonEmptyString.regex(
      /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/,
      "Resource version must use semantic versioning",
    ),
  }),
  compatibility: z.object({
    supportedProductTypes: stringList,
    supportedTechnologyStacks: stringList,
    supportedRuntimes: stringList,
    supportedPlatforms: stringList,
    incompatibleCombinations: stringList,
    minimumRuntimeToolVersions: z.record(nonEmptyString),
  }),
  capabilities: z.object({
    capabilitiesProvided: z.array(z.enum(BUILDER_RESOURCE_CAPABILITY_IDS)),
    optionalCapabilities: z.array(z.enum(BUILDER_RESOURCE_CAPABILITY_IDS)),
    dependencies: stringList,
    integrationPoints: stringList,
  }),
  contracts: z.object({
    inputContract: z.record(z.unknown()),
    outputContract: z.record(z.unknown()),
    apiContract: nullableJsonContract,
    dataContract: nullableJsonContract,
    eventsEmitted: stringList,
    eventsConsumed: stringList,
    requiredEnvironmentVariables: stringList,
    secretRequirements: stringList,
  }),
  adaptation: z.object({
    configurableFields: stringList,
    replacementPoints: stringList,
    brandingHooks: stringList,
    localizationHooks: stringList,
    authorizationHooks: stringList,
    databaseHooks: stringList,
    extensionPoints: stringList,
  }),
  composition: builderResourceCompositionSchema.default({
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
  }),
  implementation: z
    .object({
      sourcePaths: stringList,
      testPaths: stringList,
      exportPolicy: z.enum(["copy-adapt", "compose", "reference-only"]),
      requiresLiveLibraryAtRuntime: z.boolean(),
    })
    .default({
      sourcePaths: [],
      testPaths: [],
      exportPolicy: "compose",
      requiresLiveLibraryAtRuntime: false,
    }),
  evidence: z.object({
    unitTests: stringList,
    integrationTests: stringList,
    behavioralTests: stringList,
    buildEvidence: stringList,
    runtimeEvidence: stringList,
    securityEvidence: stringList,
    accessibilityEvidence: stringList,
    performanceEvidence: stringList,
    reproducibilityEvidence: stringList,
    lastVerifiedAt: z.string().datetime().nullable(),
    evidenceLedgerIds: stringList,
    adapterEvidence: adapterEvidenceSchema,
  }),
  governance: z.object({
    provenance: nonEmptyString,
    license: nonEmptyString,
    allowedUse: stringList.min(1),
    securityNotes: stringList,
    deprecationStatus: z.enum(["active", "deprecated", "retired"]),
    replacementResourceId: nonEmptyString.nullable(),
    maintainerInternalOwner: nonEmptyString,
    maturityState: z.enum(ADAPTER_CAPABILITY_STATES),
    quarantine: z
      .object({
        quarantined: z.boolean(),
        reason: nonEmptyString,
      })
      .nullable(),
  }),
});

export type BuilderResourceManifestInput = z.input<
  typeof builderResourceManifestSchema
>;
export type BuilderResourceManifest = z.output<
  typeof builderResourceManifestSchema
>;

function assertMaturityEvidence(
  state: AdapterCapabilityState,
  evidence: AdapterEvidence,
): void {
  if (state === "unsupported") return;
  const result = evaluateAdapterPromotion("unsupported", state, evidence);
  if (!result.ok) {
    throw new Error(
      `Resource maturity ${state} is not evidence-backed: ${result.missingEvidence.join(", ")}`,
    );
  }
}

export function parseBuilderResourceManifest(
  input: BuilderResourceManifestInput,
): BuilderResourceManifest {
  const parsed = builderResourceManifestSchema.parse(input);
  assertMaturityEvidence(
    parsed.governance.maturityState,
    parsed.evidence.adapterEvidence,
  );

  if (
    parsed.governance.deprecationStatus !== "active" &&
    parsed.governance.replacementResourceId === parsed.identity.resourceId
  ) {
    throw new Error("A deprecated resource cannot replace itself");
  }
  if (parsed.implementation.requiresLiveLibraryAtRuntime) {
    throw new Error(
      "Internal Builder Resources cannot require a live library connection at exported-product runtime",
    );
  }

  return parsed;
}

export function resourceProvidesCapabilities(
  resource: BuilderResourceManifest,
  required: readonly BuilderResourceCapabilityId[],
): boolean {
  const provided = new Set(resource.capabilities.capabilitiesProvided);
  return required.every((capability) => provided.has(capability));
}
