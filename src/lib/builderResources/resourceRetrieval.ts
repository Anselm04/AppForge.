import type { BuilderResourceManifest } from "./resourceManifest.js";
import type {
  BuilderResourceCandidate,
  BuilderResourceQuery,
  BuilderResourceRegistry,
} from "./resourceRegistry.js";

export type ResourceContentLoader<T> = (
  resource: BuilderResourceManifest,
) => Promise<T> | T;

export type RetrievedBuilderResource<T> = BuilderResourceCandidate & {
  content: T;
};

export type ResourceRetrievalMetrics = {
  catalogSize: number;
  metadataCandidates: number;
  contentLoads: number;
  selectedResourceIds: string[];
};

export type ResourceRetrievalResult<T> = {
  resources: RetrievedBuilderResource<T>[];
  metrics: ResourceRetrievalMetrics;
};

export async function retrieveBuilderResources<T>(input: {
  registry: BuilderResourceRegistry;
  query: BuilderResourceQuery;
  limit?: number;
  loadContent: ResourceContentLoader<T>;
}): Promise<ResourceRetrievalResult<T>> {
  const catalogSize = input.registry.list().length;
  const candidates = input.registry.query(input.query);
  const limit = Math.max(0, input.limit ?? candidates.length);
  const selected = candidates.slice(0, limit);

  const resources: RetrievedBuilderResource<T>[] = [];
  for (const candidate of selected) {
    resources.push({
      ...candidate,
      content: await input.loadContent(candidate.resource),
    });
  }

  return {
    resources,
    metrics: {
      catalogSize,
      metadataCandidates: candidates.length,
      contentLoads: resources.length,
      selectedResourceIds: resources.map(
        (entry) => `${entry.resource.identity.resourceId}@${entry.resource.identity.version}`,
      ),
    },
  };
}

export function compactResourcePromptContext(
  resources: readonly BuilderResourceManifest[],
): string {
  if (resources.length === 0) return "No reusable Builder Resources selected.";
  return resources
    .map((resource) => ({
      resource: `${resource.identity.resourceId}@${resource.identity.version}`,
      type: resource.identity.resourceType,
      capabilities: resource.capabilities.capabilitiesProvided,
      integrationPoints: resource.capabilities.integrationPoints,
      adaptationPoints: [
        ...resource.adaptation.configurableFields,
        ...resource.adaptation.extensionPoints,
      ],
      maturity: resource.governance.maturityState,
      sourcePaths: resource.implementation.sourcePaths,
    }))
    .map((entry) => JSON.stringify(entry))
    .join("\n");
}
