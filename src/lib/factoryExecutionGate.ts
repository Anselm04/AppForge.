/**
 * Single authority for generated-product execution evidence.
 *
 * A code scaffold, Python syntax check or completed LLM response cannot
 * establish that an exported application independently builds and runs.
 * This gate is shared by the worker's certification and customer evidence.
 */
export type FactoryExecutionEvidence = {
  passed?: unknown;
  stage?: unknown;
  errors?: unknown;
};

export type FactoryExecutionDecision = {
  state: "executed" | "failed" | "source_only";
  verified: boolean;
  reason: string;
  stage: string;
};

export function assessFactoryExecution(
  value: unknown,
): FactoryExecutionDecision {
  const evidence =
    value !== null && typeof value === "object"
      ? (value as FactoryExecutionEvidence)
      : null;
  const stage = typeof evidence?.stage === "string" ? evidence.stage : "";
  if (evidence?.passed === false) {
    const errors = Array.isArray(evidence.errors)
      ? evidence.errors.filter((error): error is string => typeof error === "string")
      : [];
    return {
      state: "failed",
      verified: false,
      stage,
      reason: errors[0] || "Executable project validation failed; inspect the validation logs.",
    };
  }

  // "runtime" is only produced after a local build and startup; isolated
  // and Docker stages are produced by their separate execution validators.
  // Do not accept arbitrary strings or mere successful source parsing.
  const executableStage =
    stage === "runtime" ||
    stage === "docker_node" ||
    stage === "isolated_runtime";

  if (evidence?.passed === true && executableStage) {
    return {
      state: "executed",
      verified: true,
      stage,
      reason: "Execution-grade validation evidence was recorded.",
    };
  }

  return {
    state: "source_only",
    verified: false,
    stage,
    reason:
      "Source was generated, but independent compilation and runtime behavior have not been verified for this artifact.",
  };
}

/** Keep deployment admission consistent without narrowing the adapter's type. */
export function isExecutionReadyForDeployment(
  generationMode: "runnable" | "structural",
  result: FactoryExecutionDecision,
): boolean {
  return generationMode === "runnable" && result.verified;
}
