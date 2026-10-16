import { createBuilderResourceLibraryRegistry } from "./builderResourceLibrary.js";
import type { BuilderResourceCapabilityId } from "./resourceCapabilities.js";
import type { BuilderResourceManifest } from "./resourceManifest.js";

export type BuilderResourceDiscoveryQuery = {
  capability?: BuilderResourceCapabilityId;
  technologyStack?: string;
  platform?: string;
  productType?: string;
  integrationPoint?: string;
  minimumMaturity?: BuilderResourceManifest["governance"]["maturityState"];
  limit?: number;
};

export type BuilderResourceDiscoverySummary = {
  resourceId: string;
  version: string;
  name: string;
  category: string;
  resourceType: string;
  maturity: string;
  capabilities: string[];
  stacks: string[];
  platforms: string[];
  integrationPoints: string[];
  evidenceLedgerIds: string[];
  lastVerifiedAt: string | null;
  sourcePaths: string[];
  adaptationPoints: string[];
};

export function discoverBuilderResources(
  query: BuilderResourceDiscoveryQuery,
): BuilderResourceDiscoverySummary[] {
  const registry = createBuilderResourceLibraryRegistry();
  const candidates = registry
    .query({
      productType: query.productType,
      technologyStack: query.technologyStack,
      platform: query.platform,
      requiredCapabilities: query.capability ? [query.capability] : [],
      minimumMaturity: query.minimumMaturity ?? "discovered",
    })
    .filter((candidate) => {
      if (!query.integrationPoint) return true;
      return candidate.resource.capabilities.integrationPoints.includes(
        query.integrationPoint,
      );
    })
    .slice(0, Math.max(0, query.limit ?? 20));

  return candidates.map(({ resource }) => ({
    resourceId: resource.identity.resourceId,
    version: resource.identity.version,
    name: resource.identity.name,
    category: resource.identity.category,
    resourceType: resource.identity.resourceType,
    maturity: resource.governance.maturityState,
    capabilities: [...resource.capabilities.capabilitiesProvided],
    stacks: [...resource.compatibility.supportedTechnologyStacks],
    platforms: [...resource.compatibility.supportedPlatforms],
    integrationPoints: [...resource.capabilities.integrationPoints],
    evidenceLedgerIds: [...resource.evidence.evidenceLedgerIds],
    lastVerifiedAt: resource.evidence.lastVerifiedAt,
    sourcePaths: [...resource.implementation.sourcePaths],
    adaptationPoints: [
      ...new Set([
        ...resource.adaptation.configurableFields,
        ...resource.adaptation.replacementPoints,
        ...resource.adaptation.brandingHooks,
        ...resource.adaptation.localizationHooks,
        ...resource.adaptation.authorizationHooks,
        ...resource.adaptation.databaseHooks,
        ...resource.adaptation.extensionPoints,
      ]),
    ].sort(),
  }));
}

export function answerBuilderResourceDiscoveryQuestion(input: {
  capability: BuilderResourceCapabilityId;
  technologyStack?: string;
  platform?: string;
  productType?: string;
}): {
  available: boolean;
  candidates: BuilderResourceDiscoverySummary[];
  strongestMaturity: string | null;
} {
  const candidates = discoverBuilderResources({ ...input, limit: 10 });
  return {
    available: candidates.length > 0,
    candidates,
    strongestMaturity: candidates[0]?.maturity ?? null,
  };
}
