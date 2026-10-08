/** Keep build monitoring below the shared API budget; SSE carries live updates. */
export function buildPollingInterval(
  status: string | null | undefined,
  queryFailed: boolean,
  locallyPaused: boolean,
): number | false {
  if (
    queryFailed ||
    locallyPaused ||
    [
      "paused",
      "failed",
      "cancelled",
      "validated",
      "production-certified",
    ].includes(status ?? "")
  )
    return false;
  return 15_000;
}

export function shouldRetryQuery(
  failureCount: number,
  error: unknown,
): boolean {
  const detail = error as {
    message?: unknown;
    data?: { httpStatus?: number };
    meta?: { response?: { status?: number } };
  } | null;
  const status = detail?.data?.httpStatus ?? detail?.meta?.response?.status;
  if (status === 401 || status === 403 || status === 404 || status === 429)
    return false;
  const message = String(detail?.message ?? error ?? "");
  if (
    /unauth|not authenticated|401|rate limit|too many requests/i.test(message)
  )
    return false;
  return failureCount < 2;
}

/** Plain middleware 429 responses are not tRPC envelopes. Keep their meaning. */
export function rejectRateLimitedResponse(
  response: Pick<Response, "status">,
): void {
  if (response.status === 429)
    throw new Error("Too many requests. Please wait before trying again.");
}
