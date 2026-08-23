import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../routers/index.js";

function getAccessToken(): string | null {
  try {
    const raw = localStorage.getItem("appforge.session");
    if (!raw) return null;
    const session = JSON.parse(raw);
    return session.accessToken ?? null;
  } catch {
    return null;
  }
}

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
