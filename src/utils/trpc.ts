import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../routers/index.js";
import { getAccessToken } from "../lib/auth.js";

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      headers() {
        const token = getAccessToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});
