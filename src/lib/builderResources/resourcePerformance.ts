import type { BuilderResourceRegistry } from "./resourceRegistry.js";
import type { BuilderResourceQuery } from "./resourceRegistry.js";

export type ResourceRetrievalBenchmark = {
  catalogSize: number;
  relevantCandidates: number;
  selectedCount: number;
  naiveContentLoads: number;
  resourceContentLoads: number;
  avoidedContentLoads: number;
  avoidedLoadPercent: number;
  metadataQueryDurationMs: number;
};

export function benchmarkMetadataFirstRetrieval(input: {
  registry: BuilderResourceRegistry;
  query: BuilderResourceQuery;
  limit?: number;
  now?: () => number;
}): ResourceRetrievalBenchmark {
  const now = input.now ?? (() => performance.now());
  const catalogSize = input.registry.list().length;
  const started = now();
  const candidates = input.registry.query(input.query);
  const finished = now();
  const selectedCount = Math.min(
    candidates.length,
    Math.max(0, input.limit ?? candidates.length),
  );
  const naiveContentLoads = catalogSize;
  const resourceContentLoads = selectedCount;
  const avoidedContentLoads = Math.max(0, naiveContentLoads - resourceContentLoads);

  return {
    catalogSize,
    relevantCandidates: candidates.length,
    selectedCount,
    naiveContentLoads,
    resourceContentLoads,
    avoidedContentLoads,
    avoidedLoadPercent:
      naiveContentLoads === 0
        ? 0
        : (avoidedContentLoads / naiveContentLoads) * 100,
    metadataQueryDurationMs: Math.max(0, finished - started),
  };
}

export type ResourceBuildComparison = {
  baseline: {
    generatedCodeUnits: number;
    reusableCodeUnits: number;
    repairCycles: number;
    testPassRate: number;
    requirementCoverage: number;
    defects: number;
    toolCalls: number | null;
    buildTimeMs: number | null;
    runtimeVerified: boolean;
  };
  resourceAware: {
    generatedCodeUnits: number;
    reusableCodeUnits: number;
    repairCycles: number;
    testPassRate: number;
    requirementCoverage: number;
    defects: number;
    toolCalls: number | null;
    buildTimeMs: number | null;
    runtimeVerified: boolean;
  };
  deltas: {
    generatedCodeUnits: number;
    reusableCodeUnits: number;
    repairCycles: number;
    defects: number;
  };
  reliabilityImprovedOrEqual: boolean;
};

export function compareResourceAwareBuilds(input: {
  baseline: ResourceBuildComparison["baseline"];
  resourceAware: ResourceBuildComparison["resourceAware"];
}): ResourceBuildComparison {
  return {
    ...input,
    deltas: {
      generatedCodeUnits:
        input.resourceAware.generatedCodeUnits - input.baseline.generatedCodeUnits,
      reusableCodeUnits:
        input.resourceAware.reusableCodeUnits - input.baseline.reusableCodeUnits,
      repairCycles:
        input.resourceAware.repairCycles - input.baseline.repairCycles,
      defects: input.resourceAware.defects - input.baseline.defects,
    },
    reliabilityImprovedOrEqual:
      input.resourceAware.testPassRate >= input.baseline.testPassRate &&
      input.resourceAware.requirementCoverage >=
        input.baseline.requirementCoverage &&
      input.resourceAware.defects <= input.baseline.defects,
  };
}
