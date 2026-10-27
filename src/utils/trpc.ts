import { sessionRetryLink } from "../lib/sessionRetryLink.js";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import { rejectRateLimitedResponse } from "../lib/buildPolling.js";
import type { AppRouter } from "../routers/index.js";
import {
  browserSessionHeaders,
  ensureFreshSession,
  getAccessToken,
  refreshSession,
} from "../lib/auth.js";
import { clearCsrfToken, withCsrfHeaders } from "../lib/csrf.js";

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return {
    ...browserSessionHeaders(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    sessionRetryLink<AppRouter>(),
    httpBatchLink({
      url: "/api/trpc",
      methodOverride: "POST",
      headers() {
        return authHeaders();
      },
      fetch(url, options) {
        const run = async (retried: boolean): Promise<Response> => {
          if (!retried) {
            await ensureFreshSession();
          }
          const token = getAccessToken();
          let headers = new Headers(options?.headers);
          if (token) headers.set("Authorization", `Bearer ${token}`);
          else headers.delete("Authorization");
          for (const [key, value] of Object.entries(browserSessionHeaders())) {
            headers.set(key, value);
          }
          if (!browserSessionHeaders()["x-appforge-browser-session"]) {
            headers.delete("x-appforge-browser-session");
          }
          headers = await withCsrfHeaders(headers);
          const res = await fetch(url, {
            ...options,
            headers,
            credentials: "same-origin",
          });
          rejectRateLimitedResponse(res);
          if (res.status === 403 && !retried) {
            clearCsrfToken();
            return run(true);
          }
          if (res.status === 401 && !retried) {
            const refreshed = await refreshSession();
            if (refreshed) return run(true);
          }
          return res;
        };
        return run(false);
      },
    }),
  ],
});
