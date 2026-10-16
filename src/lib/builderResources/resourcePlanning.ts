import type { BuildCapabilityId } from "../buildCapabilities.js";
import { planCreativeBuild } from "../creativeOrchestrator.js";
import { deriveRequestedProductCapabilities } from "../nativeCapabilitySelection.js";
import type { ProductContract } from "../productContract.js";
import type { ProductPlan } from "../productPlan.js";
import type { RequirementManifest } from "../requirementManifest.js";
import { createBuilderResourceLibraryRegistry } from "./builderResourceLibrary.js";
import type { BuilderResourceCapabilityId } from "./resourceCapabilities.js";
import { composeBuilderResources } from "./resourceComposition.js";
import { usageRecordForResource } from "./resourceGovernance.js";
import { compactResourcePromptContext } from "./resourceRetrieval.js";
import { selectBuilderResources } from "./resourceSelection.js";

const SECONDARY_CAPABILITY_MAP: Partial<
  Record<
    ProductContract["secondaryCapabilities"][number],
    BuilderResourceCapabilityId[]
  >
> = {
  authentication: ["authentication", "authorization"],
  database: ["database"],
  billing: ["billing", "monetization"],
  ai: ["api", "security", "observability"],
  analytics: ["analytics"],
  administration: ["authorization", "observability"],
  teams: ["collab", "authorization"],
  notifications: ["notifications"],
  search: ["search"],
  file_uploads: ["storage"],
  external_integrations: ["api", "webhooks"],
  deployment: ["observability", "security"],
};

const NATIVE_CAPABILITY_MAP: Record<string, BuilderResourceCapabilityId[]> = {
  push_notifications: ["notifications", "mobile"],
  local_notifications: ["notifications", "mobile"],
  deep_links: ["mobile"],
  universal_links: ["mobile"],
  app_links: ["mobile"],
  speech_recognition: ["voice", "mobile"],
  text_to_speech: ["voice", "mobile"],
  microphone: ["voice", "mobile"],
  background_jobs: ["background_jobs", "mobile"],
  scheduling: ["background_jobs"],
  camera: ["mobile"],
  photos: ["mobile"],
  location: ["mobile"],
  background_location: ["mobile"],
  biometrics: ["authentication", "mobile"],
  sharing: ["mobile"],
  contacts: ["mobile"],
  calendar: ["mobile"],
};

const BOOKING_INTENT =
  /\b(?:booking|reservation|reserve|appointment|availability|table availability|class booking|accommodation|vehicle rental|event tickets?)\b/i;
const ACCOUNT_INTENT =
  /\b(?:account|profile|preferences|password change|change password|email change|change email|account deletion|delete account|data export)\b/i;

export type BuilderResourcePlan = {
  requiredCapabilities: BuilderResourceCapabilityId[];
  selectedResourceIds: string[];
  usageRecords: ReturnType<typeof usageRecordForResource>[];
  missingCapabilities: BuilderResourceCapabilityId[];
  conflicts: ReturnType<typeof composeBuilderResources>["conflicts"];
  viable: boolean;
  promptContext: string;
  decisionEvidence: Array<{
    capability: BuilderResourceCapabilityId;
    resourceId: string;
    version: string;
    requirementIds: string[];
    rationale: string[];
    evidenceLedgerIds: string[];
  }>;
  retrievalMetrics: {
    catalogSize: number;
    metadataQueries: number;
    selectedCount: number;
  };
};

export function deriveRequiredBuilderCapabilities(input: {
  productContract: ProductContract;
  activeBuildCapabilities?: BuildCapabilityId[];
}): BuilderResourceCapabilityId[] {
  const required = new Set<BuilderResourceCapabilityId>(
    input.activeBuildCapabilities ?? [],
  );

  if (!input.activeBuildCapabilities) {
    const existingCreativePlan = planCreativeBuild(
      input.productContract.originalPrompt,
    );
    if (existingCreativePlan.rationale.startsWith("Matched capabilities")) {
      required.add(existingCreativePlan.primary);
      for (const capability of existingCreativePlan.supporting) {
        required.add(capability);
      }
    }
  }

  const productEvidence = [
    input.productContract.originalPrompt,
    input.productContract.canonicalInterpretation,
    ...input.productContract.coreWorkflows,
    ...input.productContract.functionalRequirements.map(
      (requirement) => requirement.text,
    ),
  ].join("\n");
  if (BOOKING_INTENT.test(productEvidence)) required.add("booking");
  if (ACCOUNT_INTENT.test(productEvidence)) required.add("account");

  for (const secondary of input.productContract.secondaryCapabilities) {
    for (const capability of SECONDARY_CAPABILITY_MAP[secondary] ?? []) {
      required.add(capability);
    }
  }
  for (const family of input.productContract.productFamilies) {
    if (family === "auth") required.add("authentication");
    if (family === "database") required.add("database");
    if (family === "billing") {
      required.add("billing");
      required.add("monetization");
    }
    if (family === "analytics") required.add("analytics");
    if (family === "mobile") required.add("mobile");
    if (family === "integrations") {
      required.add("api");
      required.add("webhooks");
    }
  }
  for (const nativeCapability of deriveRequestedProductCapabilities(
    input.productContract,
  )) {
    for (const capability of NATIVE_CAPABILITY_MAP[nativeCapability] ?? []) {
      required.add(capability);
    }
  }
  if (input.productContract.monetizationRequirements.length > 0) {
    required.add("billing");
    required.add("monetization");
  }
  if (input.productContract.securityRequirements.length > 0) {
    required.add("security");
  }
  if (input.productContract.dataModels.length > 0) {
    required.add("database");
  }
  return [...required].sort();
}

function supportsOrWildcard(
  supported: readonly string[],
  requested: string | undefined,
): boolean {
  if (!requested) return true;
  return supported.includes(requested) || supported.includes("*");
}

function resourceKey(resource: {
  identity: { resourceId: string; version: string };
}): string {
  return `${resource.identity.resourceId}@${resource.identity.version}`;
}

function addSubstantiveDomainPacks(input: {
  registry: ReturnType<typeof createBuilderResourceLibraryRegistry>;
  selectedById: Map<string, ReturnType<typeof input.registry.list>[number]>;
  decisionEvidence: BuilderResourcePlan["decisionEvidence"];
  productContract: ProductContract;
  targetPlatform?: string;
}): void {
  const all = input.registry.list();
  const canonicalResources = [...input.selectedById.values()].filter(
    (resource) => resource.identity.resourceId.startsWith("capability."),
  );

  for (const canonical of canonicalResources) {
    const domainResourceId = `domain.${canonical.identity.category}.contract-pack`;
    const domainPack = all
      .filter(
        (candidate) =>
          candidate.identity.resourceId === domainResourceId &&
          candidate.governance.deprecationStatus === "active" &&
          !candidate.governance.quarantine?.quarantined &&
          supportsOrWildcard(
            candidate.compatibility.supportedProductTypes,
            input.productContract.productType,
          ) &&
          supportsOrWildcard(
            candidate.compatibility.supportedTechnologyStacks,
            input.productContract.selectedTechnologyStack,
          ) &&
          supportsOrWildcard(
            candidate.compatibility.supportedPlatforms,
            input.targetPlatform,
          ),
      )
      .sort((left, right) =>
        right.identity.version.localeCompare(
          left.identity.version,
          undefined,
          { numeric: true, sensitivity: "base" },
        ),
      )[0];

    if (!domainPack) continue;
    const key = resourceKey(domainPack);
    if (input.selectedById.has(key)) continue;

    input.selectedById.set(key, domainPack);
    const parentDecision = input.decisionEvidence.find(
      (decision) =>
        decision.resourceId === canonical.identity.resourceId &&
        decision.version === canonical.identity.version,
    );
    const capability = domainPack.capabilities.capabilitiesProvided[0];
    if (!capability) continue;

    input.decisionEvidence.push({
      capability,
      resourceId: domainPack.identity.resourceId,
      version: domainPack.identity.version,
      requirementIds: [...(parentDecision?.requirementIds ?? [])],
      rationale: [
        `domain-pack-for:${resourceKey(canonical)}`,
        `maturity:${domainPack.governance.maturityState}`,
        "substantive-runtime-pack",
      ],
      evidenceLedgerIds: domainPack.evidence.evidenceLedgerIds,
    });
  }
}

function addDeclaredDependencies(input: {
  registry: ReturnType<typeof createBuilderResourceLibraryRegistry>;
  selectedById: Map<string, ReturnType<typeof input.registry.list>[number]>;
  decisionEvidence: BuilderResourcePlan["decisionEvidence"];
  productContract: ProductContract;
  targetPlatform?: string;
}): void {
  const all = input.registry.list();
  const selectedResourceIds = new Set(
    [...input.selectedById.values()].map(
      (resource) => resource.identity.resourceId,
    ),
  );
  const queue = [...input.selectedById.values()];
  const processed = new Set<string>();

  while (queue.length > 0) {
    const resource = queue.shift();
    if (!resource) break;
    const currentResourceKey = resourceKey(resource);
    if (processed.has(currentResourceKey)) continue;
    processed.add(currentResourceKey);

    for (const dependencyId of resource.capabilities.dependencies) {
      if (selectedResourceIds.has(dependencyId)) continue;

      const dependency = all
        .filter(
          (candidate) =>
            candidate.identity.resourceId === dependencyId &&
            candidate.governance.deprecationStatus === "active" &&
            !candidate.governance.quarantine?.quarantined &&
            supportsOrWildcard(
              candidate.compatibility.supportedProductTypes,
              input.productContract.productType,
            ) &&
            supportsOrWildcard(
              candidate.compatibility.supportedTechnologyStacks,
              input.productContract.selectedTechnologyStack,
            ) &&
            supportsOrWildcard(
              candidate.compatibility.supportedPlatforms,
              input.targetPlatform,
            ),
        )
        .sort((left, right) =>
          right.identity.version.localeCompare(
            left.identity.version,
            undefined,
            { numeric: true, sensitivity: "base" },
          ),
        )[0];

      if (!dependency) continue;

      const dependencyKey = resourceKey(dependency);
      input.selectedById.set(dependencyKey, dependency);
      selectedResourceIds.add(dependency.identity.resourceId);
      queue.push(dependency);

      const capability = dependency.capabilities.capabilitiesProvided[0];
      const alreadyRecorded = input.decisionEvidence.some(
        (decision) =>
          decision.resourceId === dependency.identity.resourceId &&
          decision.version === dependency.identity.version,
      );
      if (capability && !alreadyRecorded) {
        const parentDecision = input.decisionEvidence.find(
          (decision) =>
            decision.resourceId === resource.identity.resourceId &&
            decision.version === resource.identity.version,
        );
        input.decisionEvidence.push({
          capability,
          resourceId: dependency.identity.resourceId,
          version: dependency.identity.version,
          requirementIds: [...(parentDecision?.requirementIds ?? [])],
          rationale: [
            `dependency-of:${currentResourceKey}`,
            `maturity:${dependency.governance.maturityState}`,
            `dependency:${dependencyId}`,
          ],
          evidenceLedgerIds: dependency.evidence.evidenceLedgerIds,
        });
      }
    }
  }
}

export function createBuilderResourcePlan(input: {
  productContract: ProductContract;
  productPlan: ProductPlan;
  requirementManifest: RequirementManifest;
  activeBuildCapabilities?: BuildCapabilityId[];
  targetPlatform?: string;
  now?: string;
}): BuilderResourcePlan {
  const registry = createBuilderResourceLibraryRegistry();
  const requiredCapabilities = deriveRequiredBuilderCapabilities(input);
  const selectedById = new Map<
    string,
    ReturnType<typeof registry.list>[number]
  >();
  const missingCapabilities: BuilderResourceCapabilityId[] = [];
  const decisionEvidence: BuilderResourcePlan["decisionEvidence"] = [];

  for (const capability of requiredCapabilities) {
    const selection = selectBuilderResources({
      registry,
      productContract: input.productContract,
      productPlan: input.productPlan,
      requirementManifest: input.requirementManifest,
      targetPlatform: input.targetPlatform,
      requiredCapabilities: [capability],
      requiredAllowedUse: "internal-generation",
      now: input.now,
    });
    const candidate = selection.selected[0];
    if (!candidate) {
      missingCapabilities.push(capability);
      continue;
    }
    const key = resourceKey(candidate.resource);
    selectedById.set(key, candidate.resource);
    decisionEvidence.push({
      capability,
      resourceId: candidate.resource.identity.resourceId,
      version: candidate.resource.identity.version,
      requirementIds: [...candidate.decision.requirementIds],
      rationale: candidate.decision.rationale,
      evidenceLedgerIds: candidate.decision.evidenceLedgerIds,
    });
  }

  addSubstantiveDomainPacks({
    registry,
    selectedById,
    decisionEvidence,
    productContract: input.productContract,
    targetPlatform: input.targetPlatform,
  });
  addDeclaredDependencies({
    registry,
    selectedById,
    decisionEvidence,
    productContract: input.productContract,
    targetPlatform: input.targetPlatform,
  });

  const selected = [...selectedById.values()];
  const composition = composeBuilderResources(selected);

  return {
    requiredCapabilities,
    selectedResourceIds: selected.map(resourceKey),
    usageRecords: selected.map(usageRecordForResource),
    missingCapabilities,
    conflicts: composition.conflicts,
    viable: missingCapabilities.length === 0 && composition.ok,
    promptContext: compactResourcePromptContext(selected),
    decisionEvidence,
    retrievalMetrics: {
      catalogSize: registry.list().length,
      metadataQueries: requiredCapabilities.length,
      selectedCount: selected.length,
    },
  };
}
