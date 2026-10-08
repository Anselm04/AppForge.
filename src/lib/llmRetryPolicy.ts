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
  const payloads = Array.isArray(details) ? details : [details];
  for (const payload of payloads) {
    if (!payload || typeof payload !== "object") continue;
    const error = (payload as { error?: { details?: unknown } }).error;
    const entries = Array.isArray(error?.details) ? error.details : [];
    for (const item of entries) {
      if (!item || typeof item !== "object") continue;
      const entry = item as { retryDelay?: unknown; violations?: unknown };
      const violations = Array.isArray(entry.violations)
        ? entry.violations
        : [];
      if (
        violations.some((value) => {
          if (!value || typeof value !== "object") return false;
          const violation = value as {
            quotaMetric?: unknown;
            quotaId?: unknown;
            quotaValue?: unknown;
          };
          return (
            /per.?day/i.test(
              `${violation.quotaMetric ?? ""} ${violation.quotaId ?? ""}`,
            ) ||
            violation.quotaValue === "0" ||
            violation.quotaValue === 0
          );
        })
      )
        return null;
      const delay =
        typeof entry.retryDelay === "string"
          ? entry.retryDelay.match(/^(\d+(?:\.\d+)?)s$/)
          : null;
      if (delay) wait = Math.max(wait, Number(delay[1]) * 1000);
    }
  }
  return wait > MAX_INLINE_WAIT_MS ? null : wait;
}
