/**
 * Shared HTTP plumbing for research providers.
 *
 * Every provider call gets its own timeout linked to the build's abort signal.
 * A provider that fails, times out or answers with an error status produces a
 * visible, structured failure instead of throwing, so one bad provider can
 * never stall or silently stop a build. Only a caller abort propagates.
 */

export type ResearchFetchOutcome<T> =
  | { ok: true; status: number; data: T; headers: Headers }
  | { ok: false; status: number | null; detail: string };

export const DEFAULT_RESEARCH_TIMEOUT_MS = 12_000;

export function researchTimeoutMs(): number {
  const raw = Number(process.env.RESEARCH_PROVIDER_TIMEOUT_MS);
  return Number.isFinite(raw) && raw >= 1_000 && raw <= 60_000
    ? raw
    : DEFAULT_RESEARCH_TIMEOUT_MS;
}

export class ResearchAbortedError extends Error {
  constructor() {
    super("Research aborted by caller");
    this.name = "AbortError";
  }
}

export function isCallerAbort(signal: AbortSignal | undefined): boolean {
  return Boolean(signal?.aborted);
}

/** Describe an HTTP failure without echoing response bodies or credentials. */
export function httpFailureDetail(status: number): string {
  if (status === 401 || status === 403)
    return `http_${status}_unauthorized_or_blocked`;
  if (status === 404) return "http_404_not_found";
  if (status === 429) return "http_429_rate_limited_or_quota_exhausted";
  if (status >= 500) return `http_${status}_provider_error`;
  return `http_${status}`;
}

/**
 * Fetch with a per-call timeout. Returns a structured outcome; throws only when
 * the caller's signal aborted (so the build can stop on user cancellation).
 */
export async function researchFetch<T>(
  url: string | URL,
  init: RequestInit & {
    signal?: AbortSignal;
    timeoutMs?: number;
    parse?: "json" | "text";
    maxBytes?: number;
  } = {},
): Promise<ResearchFetchOutcome<T>> {
  const { signal, timeoutMs, parse = "json", maxBytes, ...rest } = init;
  if (isCallerAbort(signal)) throw new ResearchAbortedError();
  const timeout = AbortSignal.timeout(timeoutMs ?? researchTimeoutMs());
  const linked = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const res = await fetch(url, {
      ...rest,
      headers: {
        "User-Agent": "AppForge-Research/2.0 (+https://appforge.dev)",
        ...(rest.headers as Record<string, string> | undefined),
      },
      signal: linked,
    });
    if (!res.ok) {
      // Drain without reading potentially large bodies into memory.
      await res.body?.cancel().catch(() => undefined);
      return {
        ok: false,
        status: res.status,
        detail: httpFailureDetail(res.status),
      };
    }
    if (parse === "text") {
      const text = await readLimitedText(res, maxBytes ?? 65_536);
      return {
        ok: true,
        status: res.status,
        data: text as T,
        headers: res.headers,
      };
    }
    try {
      const data = (await res.json()) as T;
      return { ok: true, status: res.status, data, headers: res.headers };
    } catch {
      return { ok: false, status: res.status, detail: "invalid_json_response" };
    }
  } catch (error) {
    if (isCallerAbort(signal)) throw new ResearchAbortedError();
    if (timeout.aborted) return { ok: false, status: null, detail: "timeout" };
    const name = error instanceof Error ? error.name : "";
    return {
      ok: false,
      status: null,
      detail: name === "TypeError" ? "network_error" : "request_failed",
    };
  }
}

async function readLimitedText(
  res: Response,
  maxBytes: number,
): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    total += value.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, maxBytes));
}

/** Run tasks with bounded concurrency, preserving input order in the output. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await task(items[index], index);
      }
    },
  );
  await Promise.all(workers);
  return results;
}
