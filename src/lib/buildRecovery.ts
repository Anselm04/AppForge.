/** Explicit retries must never resume cancelled builds or bypass approval. */
export function isRecoverableBuildPause(
  status: string | null | undefined,
  reason: string | null | undefined,
): boolean {
  return (
    status === "paused" &&
    typeof reason === "string" &&
    ([
      "retry_after_error",
      "agent_timeout",
      "still_building",
      "validation_unavailable",
    ].includes(reason) ||
      /^still_building_soft_ceiling_\d+$/.test(reason))
  );
}

/** Research/planning must be recoverable before a validated plan exists.
 * This never authorizes generation: the pipeline still pauses for approval.
 */
export function canRetryPlanning(project: {
  status?: string | null;
  pauseReason?: string | null;
  buildStage?: string | null;
  productPlan?: unknown;
}): boolean {
  return (
    isRecoverableBuildPause(project.status, project.pauseReason) &&
    !project.productPlan &&
    ["researching", "planning", "architecture"].includes(
      project.buildStage ?? "",
    )
  );
}

/** Retain the audit history while preventing old terminal events ending a retry. */
export function currentBuildAttemptEvents<T extends { event: string }>(
  events: T[],
): T[] {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index].event === "build_resume") return events.slice(index);
  }
  return events;
}
