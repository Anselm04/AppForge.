import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  token: "expired-token" as string | null,
  ensureFreshSession: vi.fn(),
  refreshSession: vi.fn(),
}));
const captured = vi.hoisted(() => ({
  transport: null as unknown as {
    fetch: (url: string, options?: RequestInit) => Promise<Response>;
  },
}));
vi.mock("@trpc/client", () => ({
  httpBatchLink: (options: typeof captured.transport) => {
    captured.transport = options;
    return options;
  },
  createTRPCProxyClient: () => ({}),
}));
vi.mock("../lib/auth.js", () => ({
  ensureFreshSession: auth.ensureFreshSession,
  refreshSession: auth.refreshSession,
  getAccessToken: () => auth.token,
}));
vi.mock("../lib/csrf.js", () => ({
  clearCsrfToken: vi.fn(),
  withCsrfHeaders: async (headers: Headers) => headers,
}));
import "../utils/trpc.js";

describe("tRPC session refresh", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    auth.token = "expired-token";
    auth.ensureFreshSession.mockReset();
    auth.refreshSession.mockReset();
  });

  it("removes a captured expired bearer after switching to cookie authentication", async () => {
    auth.ensureFreshSession.mockImplementation(async () => {
      auth.token = null;
      return { user: { id: "owner" } };
    });
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null));
    await captured.transport.fetch("/api/trpc/projects.get", {
      headers: {
        Authorization: "Bearer expired-token",
        "X-Other": "preserved",
      },
    });
    const headers = new Headers(fetch.mock.calls[0][1]?.headers);
    expect(headers.has("Authorization")).toBe(false);
    expect(headers.get("X-Other")).toBe("preserved");
    expect(fetch.mock.calls[0][1]?.credentials).toBe("same-origin");
  });

  it("uses cookie authentication on the retry after a 401 refresh", async () => {
    auth.refreshSession.mockImplementation(async () => {
      auth.token = null;
      return { user: { id: "owner" } };
    });
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null));
    await captured.transport.fetch("/api/trpc/projects.get", {
      headers: { Authorization: "Bearer expired-token" },
    });
    expect(
      new Headers(fetch.mock.calls[0][1]?.headers).get("Authorization"),
    ).toBe("Bearer expired-token");
    expect(
      new Headers(fetch.mock.calls[1][1]?.headers).has("Authorization"),
    ).toBe(false);
    expect(auth.refreshSession).toHaveBeenCalledOnce();
  });
});
