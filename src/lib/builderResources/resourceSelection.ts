import { isAtLeast, stateRank } from "../adapterSdk.js";
import type { ProductContract } from "../productContract.js";
import type { ProductPlan } from "../productPlan.js";
import type { RequirementManifest } from "../requirementManifest.js";
import type { BuilderResourceCapabilityId } from "./resourceCapabilities.js";
import {
  resourceProvidesCapabilities,
  type BuilderResourceManifest,
} from "./resourceManifest.js";
import {
  BuilderResourceRegistry,
  type BuilderResourceCandidate,
} from "./resourceRegistry.js";

export type BuilderResourceSelectionInput = {
  registry: BuilderResourceRegistry;
  productContract: ProductContract;
  productPlan: ProductPlan;
  requirementManifest: RequirementManifest;
  targetPlatform?: string;
  requiredCapabilities?: BuilderResourceCapabilityId[];
  minimumMaturity?: BuilderResourceManifest["governance"]["maturityState"];
  maximumVerificationAgeDays?: number;
  requiredAllowedUse?: string;
  now?: string;
};

export type BuilderResourceDecision = {
  requirementIds: string[];
  evidenceLedgerIds: string[];
  selectedAt: string;
  selectionScore: number;
  rationale: string[];
};

export type SelectedBuilderResource = BuilderResourceCandidate & {
  decision: BuilderResourceDecision;
};

export type RejectedBuilderResource = {
  resourceId: string;
  version: string;
  reasons: string[];
};

export type BuilderResourceSelection = {
  selected: SelectedBuilderResource[];
  rejected: RejectedBuilderResource[];
};

function includesOrWildcard(
  values: readonly string[],
  requested?: string,
): boolean {
  if (!requested) return true;
  return values.includes(requested) || values.includes("*");
}

function daysBetween(olderIso: string, newerIso: string): number {
  const older = Date.parse(olderIso);
  const newer = Date.parse(newerIso);
  if (!Number.isFinite(older) || !Number.isFinite(newer)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, (newer - older) / 86_400_000);
}

function evidenceStrength(resource: BuilderResourceManifest): number {
  const evidence = resource.evidence.adapterEvidence;
  return [
    evidence.discovered,
    evidence.installVerified,
    evidence.compileOrBuildVerified,
    evidence.testsVerified,
    evidence.runtimeVerified,
    evidence.packageVerified,
    evidence.deploymentVerified,
    evidence.securityScanVerified,
    evidence.behavioralVerified,
    evidence.reproducibleBuild,
  ].filter((value) => value === true).length;
}

function applicableRequirementIds(
  resource: BuilderResourceManifest,
  contract: ProductContract,
  manifest: RequirementManifest,
): string[] {
  const terms = new Set(
    [
      ...resource.capabilities.integrationPoints,
      resource.identity.category,
      ...resource.capabilities.capabilitiesProvided,
    ]
      .flatMap((value) => value.toLowerCase().split(/[^a-z0-9]+/))
      .filter((value) => value.length >= 3),
  );

  const matched = manifest.requirements
    .filter((requirement) => {
      const text = requirement.text.toLowerCase();
      return [...terms].some((term) => text.includes(term));
    })
    .map((requirement) => requirement.id);

  if (matched.length > 0) return matched;

  const secondary = new Set(
    contract.secondaryCapabilities.map((value) => value.toLowerCase()),
  );
  const integrationMatch = resource.capabilities.integrationPoints.some(
    (value) => secondary.has(value.toLowerCase()),
  );
  if (integrationMatch) {
    return manifest.requirements
      .filter((requirement) => requirement.priority === "must")
      .map((requirement) => requirement.id);
  }

  return manifest.unresolvedMustHaveIds;
}

function rejectReasons(
  resource: BuilderResourceManifest,
  input: BuilderResourceSelectionInput,
  now: string,
): string[] {
  const reasons: string[] = [];
  const floor = input.minimumMaturity ?? "discovered";

  if (resource.governance.quarantine?.quarantined) reasons.push("quarantined");
  if (resource.governance.deprecationStatus !== "active")
    reasons.push("deprecated");
  if (!isAtLeast(resource.governance.maturityState, floor)) {
    reasons.push(`maturity-below:${floor}`);
  }
  if (
    !includesOrWildcard(
      resource.compatibility.supportedProductTypes,
      input.productContract.productType,
    )
  ) {
    reasons.push("product-type-incompatible");
  }
  if (
    !includesOrWildcard(
      resource.compatibility.supportedTechnologyStacks,
      input.productContract.selectedTechnologyStack,
    )
  ) {
    reasons.push("stack-incompatible");
  }
  if (
    !includesOrWildcard(
      resource.compatibility.supportedPlatforms,
      input.targetPlatform,
    )
  ) {
    reasons.push("platform-incompatible");
  }
  if (
    !resourceProvidesCapabilities(resource, input.requiredCapabilities ?? [])
  ) {
    reasons.push("capability-mismatch");
  }
  if (
    input.requiredAllowedUse &&
    !resource.governance.allowedUse.includes(input.requiredAllowedUse)
  ) {
    reasons.push(`allowed-use-missing:${input.requiredAllowedUse}`);
  }
  if (input.maximumVerificationAgeDays !== undefined) {
    const lastVerifiedAt = resource.evidence.lastVerifiedAt;
    if (
      !lastVerifiedAt ||
      daysBetween(lastVerifiedAt, now) > input.maximumVerificationAgeDays
    ) {
      reasons.push("verification-stale");
    }
  }
  if (
    resource.governance.securityNotes.some((note) =>
      /\b(?:critical|unsafe|blocked|known vulnerability|compromised)\b/i.test(
        note,
      ),
    )
  ) {
    reasons.push("security-blocked");
  }

  const knownIds = new Set(
    input.registry.list().map((candidate) => candidate.identity.resourceId),
  );
  const missingDependencies = resource.capabilities.dependencies.filter(
    (dependency) => !knownIds.has(dependency),
  );
  if (missingDependencies.length > 0) {
    reasons.push(`missing-dependencies:${missingDependencies.join(",")}`);
  }

  const incompatible = resource.compatibility.incompatibleCombinations;
  if (
    incompatible.includes(input.productContract.selectedTechnologyStack) ||
    (input.targetPlatform && incompatible.includes(input.targetPlatform))
  ) {
    reasons.push("declared-incompatibility");
  }

  return reasons;
}

function candidateScore(
  resource: BuilderResourceManifest,
  input: BuilderResourceSelectionInput,
  requirementIds: string[],
): number {
  let score = stateRank(resource.governance.maturityState) * 100;
  if (
    resource.compatibility.supportedTechnologyStacks.includes(
      input.productContract.selectedTechnologyStack,
    )
  ) {
    score += 40;
  }
  if (
    input.targetPlatform &&
    resource.compatibility.supportedPlatforms.includes(input.targetPlatform)
  ) {
    score += 30;
  }
  score += evidenceStrength(resource) * 5;
  score += requirementIds.length * 10;
  score -= resource.adaptation.replacementPoints.length * 2;
  score -= resource.capabilities.dependencies.length * 5;

  const required = input.requiredCapabilities ?? [];
  if (
    required.length === 1 &&
    resource.identity.resourceId === `core.${required[0]}`
  ) {
    score += 25;
  }

  return score;
}

export function selectBuilderResources(
  input: BuilderResourceSelectionInput,
): BuilderResourceSelection {
  if (input.productPlan.productType !== input.productContract.productType) {
    throw new Error(
      "Builder Resource selection requires ProductPlan/ProductContract product-type agreement",
    );
  }
  if (
    input.productPlan.selectedTechnologyStack !==
    input.productContract.selectedTechnologyStack
  ) {
    throw new Error(
      "Builder Resource selection requires ProductPlan/ProductContract stack agreement",
    );
  }
  if (
    input.requirementManifest.productType !==
      input.productContract.productType ||
    input.requirementManifest.selectedTechnologyStack !==
      input.productContract.selectedTechnologyStack
  ) {
    throw new Error(
      "Builder Resource selection requires requirement-manifest contract agreement",
    );
  }

  const now = input.now ?? new Date().toISOString();
  const selected: SelectedBuilderResource[] = [];
  const rejected: RejectedBuilderResource[] = [];

  for (const resource of input.registry.list()) {
    const reasons = rejectReasons(resource, input, now);
    if (reasons.length > 0) {
      rejected.push({
        resourceId: resource.identity.resourceId,
        version: resource.identity.version,
        reasons,
      });
      continue;
    }

    const requirementIds = applicableRequirementIds(
      resource,
      input.productContract,
      input.requirementManifest,
    );
    const score = candidateScore(resource, input, requirementIds);
    const rationale = [
      `maturity:${resource.governance.maturityState}`,
      `evidence:${evidenceStrength(resource)}/10`,
    ];
    if (
      resource.compatibility.supportedTechnologyStacks.includes(
        input.productContract.selectedTechnologyStack,
      )
    ) {
      rationale.push("stack:exact");
    }
    if (
      input.targetPlatform &&
      resource.compatibility.supportedPlatforms.includes(input.targetPlatform)
    ) {
      rationale.push(`platform:${input.targetPlatform}`);
    }
    if (requirementIds.length > 0) {
      rationale.push(`requirements:${requirementIds.join(",")}`);
    }
    const required = input.requiredCapabilities ?? [];
    if (
      required.length === 1 &&
      resource.identity.resourceId === `core.${required[0]}`
    ) {
      rationale.push("canonical-core-resource");
    }

    selected.push({
      resource,
      score,
      reasons: rationale,
      decision: {
        requirementIds,
        evidenceLedgerIds: resource.evidence.evidenceLedgerIds,
        selectedAt: now,
        selectionScore: score,
        rationale,
      },
    });
  }

  selected.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    const id = a.resource.identity.resourceId.localeCompare(
      b.resource.identity.resourceId,
    );
    if (id !== 0) return id;
    return b.resource.identity.version.localeCompare(
      a.resource.identity.version,
      undefined,
      { numeric: true, sensitivity: "base" },
    );
  });
  rejected.sort((a, b) => a.resourceId.localeCompare(b.resourceId));

  return { selected, rejected };
}
