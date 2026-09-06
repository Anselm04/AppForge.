let cachedToken: string | null = null;
let inflight: Promise<string> | null = null;

export function clearCsrfToken(): void {
  cachedToken = null;
  inflight = null;
}

export async function getCsrfToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  if (inflight) return inflight;
  inflight = (async () => {
    const res = await fetch("/api/csrf-token", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch CSRF token (${res.status})`);
    }
    const body = (await res.json()) as { csrfToken?: string };
    if (!body.csrfToken) {
      throw new Error("CSRF token missing from /api/csrf-token");
    }
    cachedToken = body.csrfToken;
    return cachedToken;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export async function withCsrfHeaders(
  headers: HeadersInit | undefined = {},
): Promise<Headers> {
  const h = new Headers(headers);
  const token = await getCsrfToken();
  h.set("x-csrf-token", token);
  return h;
}
