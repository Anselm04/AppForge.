import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ verify: vi.fn(), getUser: vi.fn() }));
vi.mock("../supabase-client", () => ({
  supabaseClient: {
    verifyEmailTokenHash: mocks.verify,
    getVerifiedUser: mocks.getUser,
  },
}));
vi.mock("../supabase", () => ({ supabase: { auth: {} } }));
vi.mock("../csrf", () => ({
  withCsrfHeaders: async (headers: HeadersInit) => new Headers(headers),
  clearCsrfToken: vi.fn(),
}));

describe("email action link exchange", () => {
  beforeEach(() => {
    vi.resetModules();
    window.history.replaceState({}, "", "/");
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
    const payload = btoa(
      JSON.stringify({ sub: "identity-1", email: "customer@example.com" }),
    );
    mocks.getUser.mockReset();
    mocks.getUser.mockResolvedValue({
      id: "identity-1",
      email: "customer@example.com",
    });
    mocks.verify.mockResolvedValue({
      access_token: `header.${payload}.signature`,
      refresh_token: "refresh-secret",
      user: { id: "identity-1" },
    });
  });

  it.each(["signup", "recovery"] as const)(
    "exchanges a %s hash and removes it from browser history",
    async (type) => {
      window.history.replaceState(
        {},
        "",
        `/login?next=%2Faccount&token_hash=one-time-secret&type=${type}`,
      );
      const { completeAuthRedirect } = await import("../auth");
      const session = await completeAuthRedirect();
      expect(mocks.verify).toHaveBeenCalledWith("one-time-secret", type);
      expect(session?.user.id).toBe("identity-1");
      expect(window.location.search).toBe("?next=%2Faccount");
      expect(window.location.hash).toBe("");
      expect(sessionStorage.setItem).not.toHaveBeenCalledWith(
        expect.any(String),
        "refresh-secret",
      );
    },
  );

  it("accepts a query-string OAuth token and scrubs credentials from history", async () => {
    const payload = btoa(
      JSON.stringify({ sub: "identity-2", email: "customer@example.com" }),
    );
    const accessToken = `header.${payload}.signature`;
    window.history.replaceState(
      {},
      "",
      `/login?next=%2Fdashboard&access_token=${encodeURIComponent(accessToken)}&refresh_token=private-token&token_type=bearer`,
    );
    const { completeAuthRedirect } = await import("../auth");
    mocks.getUser.mockResolvedValueOnce({
      id: "identity-2",
      email: "customer@example.com",
    });
    const session = await completeAuthRedirect();
    expect(session?.user.id).toBe("identity-2");
    expect(window.location.search).toBe("?next=%2Fdashboard");
    expect(window.location.hash).toBe("");
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("rejects a callback token whose authenticated user does not match its claims", async () => {
    const payload = btoa(JSON.stringify({ sub: "spoofed-identity" }));
    window.history.replaceState(
      {},
      "",
      `/login#access_token=header.${payload}.signature`,
    );
    mocks.getUser.mockResolvedValueOnce({ id: "different-identity" });
    const { completeAuthRedirect } = await import("../auth");
    await expect(completeAuthRedirect()).rejects.toThrow(
      /identity verification failed/,
    );
    expect(window.location.hash).toBe("");
  });

  it("rejects invalid or expired links without creating an authenticated session", async () => {
    mocks.verify.mockRejectedValue(new Error("This link is expired"));
    window.history.replaceState(
      {},
      "",
      "/password-reset?token_hash=expired&type=recovery",
    );
    const { completeAuthRedirect, getAccessToken } = await import("../auth");
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    await expect(completeAuthRedirect()).rejects.toThrow(/expired/);
    expect(getAccessToken()).toBeNull();
    expect(window.location.search).toBe("");
  });

  it("rejects unsupported verification types before contacting the provider", async () => {
    window.history.replaceState({}, "", "/login?token_hash=secret&type=admin");
    const { completeAuthRedirect } = await import("../auth");
    await expect(completeAuthRedirect()).rejects.toThrow(/invalid/);
    expect(mocks.verify).not.toHaveBeenCalled();
  });
});
