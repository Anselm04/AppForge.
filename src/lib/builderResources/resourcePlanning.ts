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

  const bookingEvidence = [
    input.productContract.originalPrompt,
    input.productContract.canonicalInterpretation,
    ...input.productContract.coreWorkflows,
    ...input.productContract.functionalRequirements.map(
      (requirement) => requirement.text,
    ),
  ].join("\n");
  if (BOOKING_INTENT.test(bookingEvidence)) required.add("booking");

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
    const key = `${candidate.resource.identity.resourceId}@${candidate.resource.identity.version}`;
    selectedById.set(key, candidate.resource);
    decisionEvidence.push({
      capability,
      resourceId: candidate.resource.identity.resourceId,
      version: candidate.resource.identity.version,
      rationale: candidate.decision.rationale,
      evidenceLedgerIds: candidate.decision.evidenceLedgerIds,
    });
  }

  const selected = [...selectedById.values()];
  const composition = composeBuilderResources(selected);

  return {
    requiredCapabilities,
    selectedResourceIds: selected.map(
      (resource) =>
        `${resource.identity.resourceId}@${resource.identity.version}`,
    ),
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
