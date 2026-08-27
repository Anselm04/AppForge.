import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../routers/index.js";
import { getAccessToken } from "../lib/auth.js";

function bearerHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      methodOverride: "POST",
      headers() {
        return bearerHeaders();
      },
      fetch(url, options) {
        const token = getAccessToken();
        const headers = new Headers(options?.headers);
        if (token) headers.set("Authorization", `Bearer ${token}`);
        return fetch(url, { ...options, headers });
      },
    }),
  ],
});
