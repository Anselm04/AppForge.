/**
 * One bounded deadline for a full LLM request, including retries/failover.
 * Keys remain server-side runtime secrets; no provider is contacted here.
 * This deadline is a safety cap, NOT proof of zero provider charges on timeout.
 */
export function llmRequestTimeoutMs(
  value: string | undefined = process.env.APPFORGE_LLM_REQUEST_TIMEOUT_MS,
): number {
  if (!value) return 60_000;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 5_000 || number > 120_000) {
    throw new Error(
      "APPFORGE_LLM_REQUEST_TIMEOUT_MS must be 5000..120000 milliseconds",
    );
  }
  return number;
}

export function llmDeadlineSignal(
  callerSignal?: AbortSignal,
  timeoutMs: number = llmRequestTimeoutMs(),
): AbortSignal {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
    throw new Error("LLM deadline must be a positive integer");
  }
  const deadline = AbortSignal.timeout(timeoutMs);
  return callerSignal ? AbortSignal.any([callerSignal, deadline]) : deadline;
}
