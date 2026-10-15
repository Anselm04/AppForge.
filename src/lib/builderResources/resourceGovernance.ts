import {
  evaluateAdapterPromotion,
  stateRank,
  type AdapterCapabilityState,
  type AdapterEvidence,
} from "../adapterSdk.js";
import {
  parseBuilderResourceManifest,
  type BuilderResourceManifest,
} from "./resourceManifest.js";

export type ResourceUsageRecord = {
  resourceId: string;
  version: string;
  evidenceLedgerIds: string[];
};

export type ResourcePromotionReview = {
  generalized: boolean;
  customerDataRemoved: boolean;
  secretsRemoved: boolean;
  deduplicated: boolean;
  licenseReviewed: boolean;
  securityReviewed: boolean;
  testsAdded: boolean;
  manifestCreated: boolean;
};

function semanticVersionParts(version: string): [number, number, number] {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) throw new Error(`Invalid semantic version ${version}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isVersionAfter(candidate: string, current: string): boolean {
  const left = semanticVersionParts(candidate);
  const right = semanticVersionParts(current);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] > right[index]) return true;
    if (left[index] < right[index]) return false;
  }
  return false;
}

export function promoteBuilderResource(
  resource: BuilderResourceManifest,
  targetState: AdapterCapabilityState,
  evidence: AdapterEvidence,
  verifiedAt: string,
): BuilderResourceManifest {
  if (resource.governance.quarantine?.quarantined) {
    throw new Error(
      "Quarantined Builder Resources must be cleared before promotion",
    );
  }
  const mergedEvidence = { ...resource.evidence.adapterEvidence, ...evidence };
  const result = evaluateAdapterPromotion(
    resource.governance.maturityState,
    targetState,
    mergedEvidence,
  );
  if (!result.ok) throw new Error(result.reason);

  return parseBuilderResourceManifest({
    ...resource,
    evidence: {
      ...resource.evidence,
      adapterEvidence: mergedEvidence,
      lastVerifiedAt: verifiedAt,
      evidenceLedgerIds: [
        ...new Set([
          ...resource.evidence.evidenceLedgerIds,
          ...(mergedEvidence.evidenceLedgerIds ?? []),
        ]),
      ],
    },
    governance: {
      ...resource.governance,
      maturityState: result.state,
      quarantine: null,
    },
  });
}

export function demoteBuilderResource(
  resource: BuilderResourceManifest,
  targetState: AdapterCapabilityState,
  reason: string,
): BuilderResourceManifest {
  if (stateRank(targetState) >= stateRank(resource.governance.maturityState)) {
    throw new Error("Resource demotion must move to a lower maturity state");
  }
  const trimmedReason = reason.trim();
  if (!trimmedReason) throw new Error("Resource demotion requires a reason");

  return parseBuilderResourceManifest({
    ...resource,
    governance: {
      ...resource.governance,
      maturityState: targetState,
      quarantine: { quarantined: true, reason: trimmedReason },
      securityNotes: [
        ...resource.governance.securityNotes,
        `Demoted: ${trimmedReason}`,
      ],
    },
  });
}

export function quarantineBuilderResource(
  resource: BuilderResourceManifest,
  reason: string,
): BuilderResourceManifest {
  const safeState: AdapterCapabilityState =
    stateRank(resource.governance.maturityState) >= stateRank("structural")
      ? "experimental"
      : resource.governance.maturityState;
  if (stateRank(safeState) < stateRank(resource.governance.maturityState)) {
    return demoteBuilderResource(resource, safeState, reason);
  }
  return parseBuilderResourceManifest({
    ...resource,
    governance: {
      ...resource.governance,
      quarantine: { quarantined: true, reason: reason.trim() || "regression" },
    },
  });
}

export function clearBuilderResourceQuarantine(
  resource: BuilderResourceManifest,
): BuilderResourceManifest {
  return parseBuilderResourceManifest({
    ...resource,
    governance: { ...resource.governance, quarantine: null },
  });
}

export function deprecateBuilderResource(
  resource: BuilderResourceManifest,
  replacementResourceId: string,
): BuilderResourceManifest {
  const replacement = replacementResourceId.trim();
  if (!replacement || replacement === resource.identity.resourceId) {
    throw new Error(
      "Deprecated Builder Resources require a different replacement id",
    );
  }
  return parseBuilderResourceManifest({
    ...resource,
    governance: {
      ...resource.governance,
      deprecationStatus: "deprecated",
      replacementResourceId: replacement,
    },
  });
}

export function createBuilderResourceVersion(
  resource: BuilderResourceManifest,
  version: string,
): BuilderResourceManifest {
  if (!isVersionAfter(version, resource.identity.version)) {
    throw new Error(
      `New Builder Resource version ${version} must be greater than ${resource.identity.version}`,
    );
  }
  return parseBuilderResourceManifest({
    ...resource,
    identity: { ...resource.identity, version },
    governance: {
      ...resource.governance,
      deprecationStatus: "active",
      replacementResourceId: null,
      quarantine: null,
    },
  });
}

export function usageRecordForResource(
  resource: BuilderResourceManifest,
): ResourceUsageRecord {
  return {
    resourceId: resource.identity.resourceId,
    version: resource.identity.version,
    evidenceLedgerIds: [...resource.evidence.evidenceLedgerIds],
  };
}

export function assertPromotionReviewComplete(
  review: ResourcePromotionReview,
): void {
  const missing = Object.entries(review)
    .filter(([, complete]) => !complete)
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(
      `Customer-build resource promotion is blocked until review completes: ${missing.join(", ")}`,
    );
  }
}

export function promoteSanitizedBuildCandidate(
  candidate: BuilderResourceManifest,
  review: ResourcePromotionReview,
): BuilderResourceManifest {
  assertPromotionReviewComplete(review);
  if (
    stateRank(candidate.governance.maturityState) > stateRank("experimental")
  ) {
    throw new Error(
      "Newly promoted customer-build resources must enter at experimental or lower maturity",
    );
  }
  return candidate;
}
