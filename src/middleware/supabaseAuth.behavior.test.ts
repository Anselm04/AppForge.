import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  refreshSession: vi.fn(),
  upsert: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: mocks }),
}));
vi.mock("../db.js", () => ({
  upsertUserFromAuth: mocks.upsert,
  ensureUserCredits: vi.fn(),
}));

describe("verified identity boundary", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("SUPABASE_URL", "https://identity.example.com");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");
    mocks.upsert.mockResolvedValue({ id: 1, name: "Customer" });
  });

  async function authenticate(user: object) {
    mocks.getUser.mockResolvedValue({ data: { user }, error: null });
    const { supabaseAuthMiddleware } = await import("./supabaseAuth.js");
    const req = {
      headers: { authorization: "Bearer valid-token" },
      query: {},
      method: "GET",
      originalUrl: "/api/trpc/auth.me",
    } as unknown as Request;
    const res = {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
      setHeader: vi.fn(),
    } as unknown as Response;
    await supabaseAuthMiddleware(req, res, vi.fn());
    return req.user;
  }

  it("does not accept editable metadata as proof of phone ownership", async () => {
    const user = await authenticate({
      id: "identity-1",
      email: "customer@example.com",
      email_confirmed_at: "2026-01-01",
      user_metadata: {
        signup_phone: "+15551234567",
        signup_phone_verified: true,
      },
    });
    expect(user?.phoneVerified).toBe(false);
  });

  it("does not confuse phone confirmation with email confirmation", async () => {
    const user = await authenticate({
      id: "identity-1",
      email: "customer@example.com",
      confirmed_at: "2026-01-01",
      phone_confirmed_at: "2026-01-01",
      phone: "+15551234567",
      user_metadata: {},
    });
    expect(user).toBeUndefined();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("accepts provider-confirmed email and phone", async () => {
    const user = await authenticate({
      id: "identity-1",
      email: "customer@example.com",
      email_confirmed_at: "2026-01-01",
      phone_confirmed_at: "2026-01-01",
      phone: "+15551234567",
      user_metadata: {},
    });
    expect(user?.phoneVerified).toBe(true);
    expect(user?.supabaseUid).toBe("identity-1");
  });
});
