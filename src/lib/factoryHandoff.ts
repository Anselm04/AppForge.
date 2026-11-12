import { getStackAdapter } from "./stackAdapters.js";

export type FactoryHandoff = {
  stage: "source_ready" | "runtime_verified" | "blocked";
  sourceReady: boolean;
  runtimeVerified: boolean;
  artifactSha256: string | null;
  snapshotId: number | null;
  artifactVersion: number | null;
  problems: string[];
};

/**
 * One authoritative contract between the agent pipeline, durable artifact
 * storage, validation, and the customer completion event.
 * A success-shaped status string is NEVER native/runtime execution evidence.
 */
export function hasExecutedBuildProof(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const result = value as { passed?: unknown; stage?: unknown; warning?: unknown };
const stage = typeof result.stage === "string" ? result.stage : "";
const warning = typeof result.warning === "string" ? result.warning : "";
return
  result.passed === true &&
  (stage === "runtime" ||
    (/^isolated[\w-]*$/i.test(stage) &&
      /isolated production validation passed/i.test(warning)) ||
    (/^docker[\w-]*$/i.test(stage) &&
      /docker sandbox passed/i.test(warning)));
}

export function evaluateFactoryHandoff(input: {
  stack: string;
  snapshotId?: number | null;
  artifactVersion?: number | null;
  artifactSha256?: string | null;
  files: Record<string, string>;
  validationResult?: unknown;
}): FactoryHandoff {
  const problems: string[] = [];
  const adapter = getStackAdapter(input.stack);
  const sha =
    typeof input.artifactSha256 === "string" &&
    /^[0-9a-f]{64}$/i.test(input.artifactSha256)
      ? input.artifactSha256.toLowerCase()
      : null;
  const snapshotId = input.snapshotId ?? null;
  const artifactVersion = input.artifactVersion ?? null;
  if (!Number.isSafeInteger(snapshotId) || (snapshotId ?? 0) <= 0) {
    problems.push("No persisted snapshot ID.");
  }
  if (!Number.isSafeInteger(artifactVersion) || (artifactVersion ?? 0) <= 0) {
    problems.push("No persisted artifact version.");
  }
  if (!sha) problems.push("No valid content integrity hash.");
  if (Object.keys(input.files).length === 0) {
    problems.push("Saved artifact contains no source files.");
  }
  const validSnapshot = problems.length === 0;
  const result =
    input.validationResult &&
    typeof input.validationResult === "object" &&
    !Array.isArray(input.validationResult)
      ? (input.validationResult as {
          passed?: unknown;
          stage?: unknown;
          warning?: unknown;
        })
      : {};
  const executionProof = hasExecutedBuildProof(result);
  const runtimeVerified =
    validSnapshot &&
    adapter.generationMode === "runnable" &&
    executionProof;
  if (result.passed === false) {
    problems.push("Generated source failed validation.");
  }
  if (adapter.generationMode === "runnable" && !executionProof) {
    problems.push("Runnable stack lacks executed build/runtime proof.");
  }
  return {
    stage: !validSnapshot
      ? "blocked"
      : runtimeVerified
        ? "runtime_verified"
        : "source_ready",
    sourceReady: validSnapshot,
    runtimeVerified,
    artifactSha256: sha,
    snapshotId,
    artifactVersion,
    problems,
  };
}
