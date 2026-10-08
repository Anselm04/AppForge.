/** Explicit retries must never resume cancelled builds or bypass approval. */
export function isRecoverableBuildPause(
  status: string | null | undefined,
  reason: string | null | undefined,
): boolean {
  return (
    status === "paused" &&
    typeof reason === "string" &&
    (["retry_after_error", "agent_timeout", "still_building"].includes(
      reason,
    ) ||
      /^still_building_soft_ceiling_\d+$/.test(reason))
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
