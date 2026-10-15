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

export type BuildHarnessMetrics = {
  requestedCapabilities: number;
  reusableCapabilities: number;
  generatedCapabilities: number;
  generatorCalls: number;
  generatedFiles: number;
  generatedCodeBytes: number;
  selectedResourceVersions: string[];
  missingCapabilities: BuilderResourceCapabilityId[];
  elapsedMs: number;
};

export type ResourceAwareBuildHarnessResult = {
  baseline: BuildHarnessMetrics;
  resourceAware: BuildHarnessMetrics;
  resourcePlan: BuilderResourcePlan;
  improvement: {
    generatorCallsAvoided: number;
    generatedCodeBytesAvoided: number;
    generatorCallReductionPercent: number;
  };
};

function bytes(files: Record<string, string>): number {
  return Object.values(files).reduce(
    (total, source) => total + Buffer.byteLength(source, "utf8"),
    0,
  );
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

  const baseline: BuildHarnessMetrics = {
    requestedCapabilities: required.length,
    reusableCapabilities: 0,
    generatedCapabilities: required.length,
    generatorCalls: baselineGenerated.calls,
    generatedFiles: Object.keys(baselineGenerated.files).length,
    generatedCodeBytes: bytes(baselineGenerated.files),
    selectedResourceVersions: [],
    missingCapabilities: [...required],
    elapsedMs: Math.max(0, baselineEnd - baselineStart),
  };
  const resourceAware: BuildHarnessMetrics = {
    requestedCapabilities: required.length,
    reusableCapabilities:
      required.length - resourcePlan.missingCapabilities.length,
    generatedCapabilities: resourcePlan.missingCapabilities.length,
    generatorCalls: resourceGenerated.calls,
    generatedFiles: Object.keys(resourceGenerated.files).length,
    generatedCodeBytes: bytes(resourceGenerated.files),
    selectedResourceVersions: [...resourcePlan.selectedResourceIds],
    missingCapabilities: [...resourcePlan.missingCapabilities],
    elapsedMs: Math.max(0, resourceEnd - resourceStart),
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
      generatedCodeBytesAvoided,
      generatorCallReductionPercent:
        baseline.generatorCalls === 0
          ? 0
          : (generatorCallsAvoided / baseline.generatorCalls) * 100,
    },
  };
}
