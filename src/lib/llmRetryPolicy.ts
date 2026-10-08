const MAX_INLINE_WAIT_MS = 30_000;

/** A long cooldown must pause/fail over rather than retry before it expires. */
export function llmRetryWait(
  status: number,
  retryAfter: string | null,
  details: unknown,
  now = Date.now(),
): number | null {
  if (status !== 408 && status !== 429 && (status < 500 || status > 599)) {
    return null;
  }
  let wait = 0;
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const value = Number.isFinite(seconds)
      ? seconds * 1000
      : Date.parse(retryAfter) - now;
    if (Number.isFinite(value)) wait = Math.max(0, value);
  }
  if (details && typeof details === "object") {
    const error = (details as { error?: { details?: unknown[] } }).error;
    for (const item of error?.details ?? []) {
      if (!item || typeof item !== "object") continue;
      const entry = item as {
        retryDelay?: string;
        violations?: {
          quotaMetric?: string;
          quotaId?: string;
          quotaValue?: string;
        }[];
      };
      if (
        entry.violations?.some(
          (violation) =>
            /per.?day/i.test(
              `${violation.quotaMetric ?? ""} ${violation.quotaId ?? ""}`,
            ) || violation.quotaValue === "0",
        )
      )
        return null;
      const delay = entry.retryDelay?.match(/^(\d+(?:\.\d+)?)s$/);
      if (delay) wait = Math.max(wait, Number(delay[1]) * 1000);
    }
  }
  return wait > MAX_INLINE_WAIT_MS ? null : wait;
}
