import {
  isAtLeast,
  stateRank,
  type AdapterCapabilityState,
} from "../adapterSdk.js";
import type { BuilderResourceCapabilityId } from "./resourceCapabilities.js";
import {
  resourceProvidesCapabilities,
  type BuilderResourceManifest,
} from "./resourceManifest.js";

export type BuilderResourceQuery = {
  productType?: string;
  technologyStack?: string;
  platform?: string;
  runtime?: string;
  requiredCapabilities?: BuilderResourceCapabilityId[];
  minimumMaturity?: AdapterCapabilityState;
  includeDeprecated?: boolean;
  includeQuarantined?: boolean;
};

export type BuilderResourceCandidate = {
  resource: BuilderResourceManifest;
  score: number;
  reasons: string[];
};

function matchesExactOrWildcard(
  supported: readonly string[],
  requested: string | undefined,
): boolean {
  if (!requested) return true;
  return supported.includes(requested) || supported.includes("*");
}

function canonicalResourceIds(
  capability: BuilderResourceCapabilityId,
): Set<string> {
  const dashed = capability.replace(/_/g, "-");
  return new Set([
    `core.${capability}`,
    `core.${dashed}`,
    `capability.${capability}`,
    `capability.${dashed}`,
  ]);
}

function isCanonicalCapabilityResource(
  resource: BuilderResourceManifest,
  requiredCapabilities: readonly BuilderResourceCapabilityId[],
): boolean {
  if (requiredCapabilities.length !== 1) return false;
  return canonicalResourceIds(requiredCapabilities[0]).has(
    resource.identity.resourceId,
  );
}

function candidateScore(
  resource: BuilderResourceManifest,
  query: BuilderResourceQuery,
): BuilderResourceCandidate {
  const reasons: string[] = [];
  let score = stateRank(resource.governance.maturityState) * 100;

  if (
    query.technologyStack &&
    resource.compatibility.supportedTechnologyStacks.includes(
      query.technologyStack,
    )
  ) {
    score += 30;
    reasons.push("stack:exact");
  }
  if (
    query.platform &&
    resource.compatibility.supportedPlatforms.includes(query.platform)
  ) {
    score += 20;
    reasons.push(`platform:${query.platform}`);
  }
  if (
    query.productType &&
    resource.compatibility.supportedProductTypes.includes(query.productType)
  ) {
    score += 15;
    reasons.push(`product:${query.productType}`);
  }
  if (
    query.runtime &&
    resource.compatibility.supportedRuntimes.includes(query.runtime)
  ) {
    score += 10;
    reasons.push(`runtime:${query.runtime}`);
  }

  const required = query.requiredCapabilities ?? [];
  if (required.length > 0) {
    score += required.length * 10;
    reasons.push(...required.map((capability) => `capability:${capability}`));

    if (isCanonicalCapabilityResource(resource, required)) {
      score += 1_000;
      reasons.push("capability-role:canonical");
    }
    if (required.length === 1 && resource.identity.resourceType === "component") {
      score -= 50;
    }
  }

  score -= resource.capabilities.dependencies.length * 5;

  return { resource, score, reasons };
}

export class BuilderResourceRegistry {
  private readonly resources: BuilderResourceManifest[];

  constructor(resources: readonly BuilderResourceManifest[] = []) {
    const identities = new Set<string>();
    for (const resource of resources) {
      const identity = `${resource.identity.resourceId}@${resource.identity.version}`;
      if (identities.has(identity)) {
        throw new Error(`Duplicate Builder Resource identity: ${identity}`);
      }
      identities.add(identity);
    }
    this.resources = [...resources];
  }

  list(): BuilderResourceManifest[] {
    return [...this.resources];
  }

  query(query: BuilderResourceQuery): BuilderResourceCandidate[] {
    const required = query.requiredCapabilities ?? [];
    const floor = query.minimumMaturity ?? "discovered";

    return this.resources
      .filter((resource) => {
        if (
          !query.includeQuarantined &&
          resource.governance.quarantine?.quarantined
        ) {
          return false;
        }
        if (
          !query.includeDeprecated &&
          resource.governance.deprecationStatus !== "active"
        ) {
          return false;
        }
        if (!isAtLeast(resource.governance.maturityState, floor)) return false;
        if (
          !matchesExactOrWildcard(
            resource.compatibility.supportedProductTypes,
            query.productType,
          )
        ) {
          return false;
        }
        if (
          !matchesExactOrWildcard(
            resource.compatibility.supportedTechnologyStacks,
            query.technologyStack,
          )
        ) {
          return false;
        }
        if (
          !matchesExactOrWildcard(
            resource.compatibility.supportedPlatforms,
            query.platform,
          )
        ) {
          return false;
        }
        if (
          !matchesExactOrWildcard(
            resource.compatibility.supportedRuntimes,
            query.runtime,
          )
        ) {
          return false;
        }
        return resourceProvidesCapabilities(resource, required);
      })
      .map((resource) => candidateScore(resource, query))
      .sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        const idOrder = a.resource.identity.resourceId.localeCompare(
          b.resource.identity.resourceId,
        );
        if (idOrder !== 0) return idOrder;
        return b.resource.identity.version.localeCompare(
          a.resource.identity.version,
          undefined,
          { numeric: true, sensitivity: "base" },
        );
      });
  }
}

export function queryResources(
  resources: readonly BuilderResourceManifest[],
  query: BuilderResourceQuery,
): BuilderResourceCandidate[] {
  return new BuilderResourceRegistry(resources).query(query);
}
