import type { BuildCapabilityId } from "../buildCapabilities.js";
import type { ProductContract } from "../productContract.js";
import type { ProductPlan } from "../productPlan.js";
import type { RequirementManifest } from "../requirementManifest.js";
import type { BuilderResourceCapabilityId } from "./resourceCapabilities.js";
import {
  createBuilderResourcePlan,
  deriveRequiredBuilderCapabilities,
  type BuilderResourcePlan,
} from "./resourcePlanning.js";

export type CustomCapabilityGenerator = (
  capability: BuilderResourceCapabilityId,
) => Promise<Record<string, string>> | Record<string, string>;

export type BuildHarnessObservation = {
  repairCycles: number;
  testsPassed: number;
  testsFailed: number;
  defects: number;
  requirementsSatisfied: number;
  requirementsTotal: number;
  runtimeSucceeded: boolean;
  outputQualityScore: number;
};

export type BuildHarnessMetrics = {
  requestedCapabilities: number;
  reusableCapabilities: number;
  generatedCapabilities: number;
  generatorCalls: number;
  aiToolCalls: number;
  generatedFiles: number;
  generatedCodeBytes: number;
  reusedResourceCount: number;
  reusedCodeBytes: number | null;
  selectedResourceVersions: string[];
  missingCapabilities: BuilderResourceCapabilityId[];
  elapsedMs: number;
  repairCycles: number | null;
  testsPassed: number | null;
  testsFailed: number | null;
  testPassRatePercent: number | null;
  defects: number | null;
  requirementsSatisfied: number | null;
  requirementsTotal: number | null;
  requirementCoveragePercent: number | null;
  runtimeSucceeded: boolean | null;
  outputQualityScore: number | null;
};

export type ResourceAwareBuildHarnessResult = {
  baseline: BuildHarnessMetrics;
  resourceAware: BuildHarnessMetrics;
  resourcePlan: BuilderResourcePlan;
  improvement: {
    generatorCallsAvoided: number;
    aiToolCallsAvoided: number;
    generatedCodeBytesAvoided: number;
    generatorCallReductionPercent: number;
    buildTimeMsDelta: number;
    repairCyclesAvoided: number | null;
    defectsAvoided: number | null;
    testPassRateDelta: number | null;
    requirementCoverageDelta: number | null;
    outputQualityDelta: number | null;
  };
};

function bytes(files: Record<string, string>): number {
  return Object.values(files).reduce(
    (total, source) => total + Buffer.byteLength(source, "utf8"),
    0,
  );
}

function percent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

function observedMetrics(
  observation: BuildHarnessObservation | undefined,
): Pick<
  BuildHarnessMetrics,
  | "repairCycles"
  | "testsPassed"
  | "testsFailed"
  | "testPassRatePercent"
  | "defects"
  | "requirementsSatisfied"
  | "requirementsTotal"
  | "requirementCoveragePercent"
  | "runtimeSucceeded"
  | "outputQualityScore"
> {
  if (!observation) {
    return {
      repairCycles: null,
      testsPassed: null,
      testsFailed: null,
      testPassRatePercent: null,
      defects: null,
      requirementsSatisfied: null,
      requirementsTotal: null,
      requirementCoveragePercent: null,
      runtimeSucceeded: null,
      outputQualityScore: null,
    };
  }

  const totalTests = observation.testsPassed + observation.testsFailed;
  return {
    repairCycles: observation.repairCycles,
    testsPassed: observation.testsPassed,
    testsFailed: observation.testsFailed,
    testPassRatePercent: percent(observation.testsPassed, totalTests),
    defects: observation.defects,
    requirementsSatisfied: observation.requirementsSatisfied,
    requirementsTotal: observation.requirementsTotal,
    requirementCoveragePercent: percent(
      observation.requirementsSatisfied,
      observation.requirementsTotal,
    ),
    runtimeSucceeded: observation.runtimeSucceeded,
    outputQualityScore: observation.outputQualityScore,
  };
}

function nullableDelta(
  baseline: number | null,
  resourceAware: number | null,
): number | null {
  if (baseline === null || resourceAware === null) return null;
  return resourceAware - baseline;
}

function nullableAvoided(
  baseline: number | null,
  resourceAware: number | null,
): number | null {
  if (baseline === null || resourceAware === null) return null;
  return baseline - resourceAware;
}

async function generateCapabilities(
  capabilities: readonly BuilderResourceCapabilityId[],
  generate: CustomCapabilityGenerator,
): Promise<{ files: Record<string, string>; calls: number }> {
  const files: Record<string, string> = {};
  let calls = 0;
  for (const capability of capabilities) {
    calls += 1;
    Object.assign(files, await generate(capability));
  }
  return { files, calls };
}

export async function compareBaselineAndResourceAwareBuild(input: {
  productContract: ProductContract;
  productPlan: ProductPlan;
  requirementManifest: RequirementManifest;
  activeBuildCapabilities?: BuildCapabilityId[];
  targetPlatform?: string;
  generateCapability: CustomCapabilityGenerator;
  measureReusableResourceBytes?: (resourceVersionId: string) => number;
  observations?: {
    baseline?: BuildHarnessObservation;
    resourceAware?: BuildHarnessObservation;
  };
  now?: () => number;
}): Promise<ResourceAwareBuildHarnessResult> {
  const now = input.now ?? (() => performance.now());
  const required = deriveRequiredBuilderCapabilities(input);

  const baselineStart = now();
  const baselineGenerated = await generateCapabilities(
    required,
    input.generateCapability,
  );
  const baselineEnd = now();

  const resourcePlan = createBuilderResourcePlan({
    productContract: input.productContract,
    productPlan: input.productPlan,
    requirementManifest: input.requirementManifest,
    activeBuildCapabilities: input.activeBuildCapabilities,
    targetPlatform: input.targetPlatform,
  });

  const resourceStart = now();
  const resourceGenerated = await generateCapabilities(
    resourcePlan.missingCapabilities,
    input.generateCapability,
  );
  const resourceEnd = now();

  const baselineObserved = observedMetrics(input.observations?.baseline);
  const resourceObserved = observedMetrics(input.observations?.resourceAware);
  const reusedCodeBytes = input.measureReusableResourceBytes
    ? resourcePlan.selectedResourceIds.reduce(
        (total, resourceVersionId) =>
          total +
          Math.max(
            0,
            input.measureReusableResourceBytes?.(resourceVersionId) ?? 0,
          ),
        0,
      )
    : null;

  const baseline: BuildHarnessMetrics = {
    requestedCapabilities: required.length,
    reusableCapabilities: 0,
    generatedCapabilities: required.length,
    generatorCalls: baselineGenerated.calls,
    aiToolCalls: baselineGenerated.calls,
    generatedFiles: Object.keys(baselineGenerated.files).length,
    generatedCodeBytes: bytes(baselineGenerated.files),
    reusedResourceCount: 0,
    reusedCodeBytes: 0,
    selectedResourceVersions: [],
    missingCapabilities: [...required],
    elapsedMs: Math.max(0, baselineEnd - baselineStart),
    ...baselineObserved,
  };
  const resourceAware: BuildHarnessMetrics = {
    requestedCapabilities: required.length,
    reusableCapabilities:
      required.length - resourcePlan.missingCapabilities.length,
    generatedCapabilities: resourcePlan.missingCapabilities.length,
    generatorCalls: resourceGenerated.calls,
    aiToolCalls: resourceGenerated.calls,
    generatedFiles: Object.keys(resourceGenerated.files).length,
    generatedCodeBytes: bytes(resourceGenerated.files),
    reusedResourceCount: resourcePlan.selectedResourceIds.length,
    reusedCodeBytes,
    selectedResourceVersions: [...resourcePlan.selectedResourceIds],
    missingCapabilities: [...resourcePlan.missingCapabilities],
    elapsedMs: Math.max(0, resourceEnd - resourceStart),
    ...resourceObserved,
  };

  const generatorCallsAvoided =
    baseline.generatorCalls - resourceAware.generatorCalls;
  const generatedCodeBytesAvoided =
    baseline.generatedCodeBytes - resourceAware.generatedCodeBytes;

  return {
    baseline,
    resourceAware,
    resourcePlan,
    improvement: {
      generatorCallsAvoided,
      aiToolCallsAvoided: baseline.aiToolCalls - resourceAware.aiToolCalls,
      generatedCodeBytesAvoided,
      generatorCallReductionPercent:
        baseline.generatorCalls === 0
          ? 0
          : (generatorCallsAvoided / baseline.generatorCalls) * 100,
      buildTimeMsDelta: resourceAware.elapsedMs - baseline.elapsedMs,
      repairCyclesAvoided: nullableAvoided(
        baseline.repairCycles,
        resourceAware.repairCycles,
      ),
      defectsAvoided: nullableAvoided(baseline.defects, resourceAware.defects),
      testPassRateDelta: nullableDelta(
        baseline.testPassRatePercent,
        resourceAware.testPassRatePercent,
      ),
      requirementCoverageDelta: nullableDelta(
        baseline.requirementCoveragePercent,
        resourceAware.requirementCoveragePercent,
      ),
      outputQualityDelta: nullableDelta(
        baseline.outputQualityScore,
        resourceAware.outputQualityScore,
      ),
    },
  };
}
