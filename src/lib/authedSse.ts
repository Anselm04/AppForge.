import {
  ensureFreshSession,
  getAccessToken,
  refreshSession,
} from "./auth.js";

export type SseHandler = (event: string, data: string) => void;

function applyAuthHeaders(headers: Headers) {
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "text/event-stream");
  headers.set("Cache-Control", "no-cache");
  headers.set("X-No-Compression", "1");
}

/** Parse one SSE frame (event + data lines). Exported for tests. */
export function parseSseFrame(
  frame: string,
): { event: string; data: string } | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const rawLine of frame.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}

export async function readSseBody(
  body: ReadableStream<Uint8Array>,
  onEvent: SseHandler,
  signal?: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const abort = () => {
    void reader.cancel().catch(() => {});
  };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    while (!signal?.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const parsed = parseSseFrame(frame);
        if (!parsed || parsed.event === "ping") continue;
        onEvent(parsed.event, parsed.data);
      }
    }
  } finally {
    signal?.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}

/**
 * Open an authenticated SSE stream for generate/build.
 * Sends the session JWT as Authorization (EventSource cannot) and as
 * `?token=` fallback. Refreshes once on 401 instead of treating the
 * user as logged out.
 */
export async function consumeAuthedSse(
  path: string,
  onEvent: SseHandler,
  signal?: AbortSignal,
): Promise<void> {
  await ensureFreshSession();

  const open = async (retried: boolean): Promise<Response> => {
    const token = getAccessToken();
    if (!token) {
      const err = new Error("Not authenticated");
      (err as Error & { status?: number }).status = 401;
      throw err;
    }
    const headers = new Headers();
    applyAuthHeaders(headers);
    const sep = path.includes("?") ? "&" : "?";
    const url = `${path}${sep}token=${encodeURIComponent(token)}`;
    const res = await fetch(url, {
      method: "GET",
      headers,
      credentials: "same-origin",
      signal,
      cache: "no-store",
    });
    if (res.status === 401 && !retried) {
      const refreshed = await refreshSession();
      if (refreshed) return open(true);
    }
    return res;
  };

  const res = await open(false);
  if (signal?.aborted) return;
  if (res.status === 401) {
    const err = new Error("Not authenticated");
    (err as Error & { status?: number }).status = 401;
    throw err;
  }
  if (!res.ok) {
    let message = `Build stream failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      message = body.message || body.error || message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  if (!res.body) {
    throw new Error("Build stream had no body");
  }
  await readSseBody(res.body, onEvent, signal);
}
