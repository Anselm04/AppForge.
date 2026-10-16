import { readFileSync } from "node:fs";
import { posix as path } from "node:path";
import type { ProductPlanTask } from "../productPlan.js";
import { createBuilderResourceLibraryRegistry } from "./builderResourceLibrary.js";
import type { BuilderResourceManifest } from "./resourceManifest.js";
import type { BuilderResourcePlan } from "./resourcePlanning.js";
import { assertBuilderResourceSupplyChainSafe } from "./resourceSupplyChain.js";

const DEFAULT_MAX_RESOURCES = 6;
const DEFAULT_MAX_SOURCE_PATHS_PER_RESOURCE = 2;
const DEFAULT_MAX_CHARS_PER_SOURCE = 2_500;
const DEFAULT_MAX_TOTAL_SOURCE_CHARS = 18_000;

export type MaterializedResourceSource = {
  path: string;
  content: string;
  truncated: boolean;
};

export type MaterializedTaskResource = {
  resourceId: string;
  version: string;
  maturity: BuilderResourceManifest["governance"]["maturityState"];
  exportPolicy: BuilderResourceManifest["implementation"]["exportPolicy"];
  requirementIds: string[];
  capabilitiesProvided: string[];
  contracts: BuilderResourceManifest["contracts"];
  adaptation: BuilderResourceManifest["adaptation"];
  composition: BuilderResourceManifest["composition"];
  sourceExcerpts: MaterializedResourceSource[];
};

export type MaterializedTaskResourceBundle = {
  resources: MaterializedTaskResource[];
  selectedResourceVersionIds: string[];
  loadedSourcePaths: string[];
  sourceCharsLoaded: number;
  promptContext: string;
};

type SourceReader = (sourcePath: string) => string;

function resourceVersionId(resource: BuilderResourceManifest): string {
  return `${resource.identity.resourceId}@${resource.identity.version}`;
}

function safeRepositorySourcePath(sourcePath: string): boolean {
  const portableSourcePath = sourcePath.replace(/\\/g, "/");
  const normalized = path.normalize(portableSourcePath);
  return (
    normalized === portableSourcePath &&
    normalized.startsWith("src/") &&
    !normalized.includes("../") &&
    !normalized.endsWith("/.env") &&
    !normalized.includes("/.env.")
  );
}

function decisionRequirementIds(
  plan: BuilderResourcePlan,
  resourceId: string,
  version: string,
): string[] {
  return [
    ...new Set(
      plan.decisionEvidence
        .filter(
          (decision) =>
            decision.resourceId === resourceId && decision.version === version,
        )
        .flatMap((decision) => decision.requirementIds),
    ),
  ].sort();
}

function isRelevantToTask(
  plan: BuilderResourcePlan,
  task: ProductPlanTask,
  resource: BuilderResourceManifest,
): boolean {
  const requirementIds = decisionRequirementIds(
    plan,
    resource.identity.resourceId,
    resource.identity.version,
  );
  if (requirementIds.length === 0) return false;
  const taskRequirements = new Set(task.requirementIds);
  return requirementIds.some((requirementId) =>
    taskRequirements.has(requirementId),
  );
}

function defaultReadSource(sourcePath: string): string {
  return readFileSync(sourcePath, "utf8");
}

export function materializeTaskBuilderResources(input: {
  plan: BuilderResourcePlan;
  task: ProductPlanTask;
  readSource?: SourceReader;
  maxResources?: number;
  maxSourcePathsPerResource?: number;
  maxCharsPerSource?: number;
  maxTotalSourceChars?: number;
}): MaterializedTaskResourceBundle {
  const registry = createBuilderResourceLibraryRegistry();
  const byVersionId = new Map(
    registry.list().map((resource) => [resourceVersionId(resource), resource]),
  );
  const readSource = input.readSource ?? defaultReadSource;
  const maxResources = Math.max(0, input.maxResources ?? DEFAULT_MAX_RESOURCES);
  const maxSourcePathsPerResource = Math.max(
    0,
    input.maxSourcePathsPerResource ?? DEFAULT_MAX_SOURCE_PATHS_PER_RESOURCE,
  );
  const maxCharsPerSource = Math.max(
    0,
    input.maxCharsPerSource ?? DEFAULT_MAX_CHARS_PER_SOURCE,
  );
  const maxTotalSourceChars = Math.max(
    0,
    input.maxTotalSourceChars ?? DEFAULT_MAX_TOTAL_SOURCE_CHARS,
  );

  const selected = input.plan.selectedResourceIds
    .map((versionId) => byVersionId.get(versionId))
    .filter((resource): resource is BuilderResourceManifest => Boolean(resource))
    .filter((resource) => isRelevantToTask(input.plan, input.task, resource))
    .slice(0, maxResources);

  const resources: MaterializedTaskResource[] = [];
  const loadedSourcePaths: string[] = [];
  let sourceCharsLoaded = 0;

  for (const resource of selected) {
    assertBuilderResourceSupplyChainSafe(resource);
    const sourceExcerpts: MaterializedResourceSource[] = [];

    if (resource.implementation.exportPolicy !== "reference-only") {
      for (const sourcePath of resource.implementation.sourcePaths
        .filter(safeRepositorySourcePath)
        .slice(0, maxSourcePathsPerResource)) {
        if (sourceCharsLoaded >= maxTotalSourceChars) break;
        try {
          const raw = readSource(sourcePath);
          const remaining = maxTotalSourceChars - sourceCharsLoaded;
          const allowed = Math.min(maxCharsPerSource, remaining);
          if (allowed <= 0) break;
          const content = raw.slice(0, allowed);
          sourceCharsLoaded += content.length;
          loadedSourcePaths.push(sourcePath);
          sourceExcerpts.push({
            path: sourcePath,
            content,
            truncated: raw.length > content.length,
          });
        } catch {
          // A missing optional source excerpt does not make the ProductContract
          // disappear. The resource contracts still reach the specialist and
          // normal custom generation remains available for unmet work.
        }
      }
    }

    resources.push({
      resourceId: resource.identity.resourceId,
      version: resource.identity.version,
      maturity: resource.governance.maturityState,
      exportPolicy: resource.implementation.exportPolicy,
      requirementIds: decisionRequirementIds(
        input.plan,
        resource.identity.resourceId,
        resource.identity.version,
      ),
      capabilitiesProvided: [...resource.capabilities.capabilitiesProvided],
      contracts: resource.contracts,
      adaptation: resource.adaptation,
      composition: resource.composition,
      sourceExcerpts,
    });
  }

  const promptContext =
    resources.length === 0
      ? "No task-relevant reusable Builder Resource implementation was materialized. Generate the unmet task normally from the ProductContract."
      : [
          "Use these PRIVATE INTERNAL AppForge Builder Resources only as implementation inputs for this task.",
          "Adapt them to the ProductContract and owned files. Do not force the product to fit a resource.",
          "Do not expose AppForge-internal paths or require the exported product to connect to this library at runtime.",
          "Generate custom code for any requirement the reusable material does not satisfy.",
          ...resources.map((resource) => JSON.stringify(resource)),
        ].join("\n");

  return {
    resources,
    selectedResourceVersionIds: resources.map(
      (resource) => `${resource.resourceId}@${resource.version}`,
    ),
    loadedSourcePaths,
    sourceCharsLoaded,
    promptContext,
  };
}
