import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const mocks = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("../db.js", () => ({
  upsertUserFromAuth: vi.fn(async () => ({ id: 42, name: "Customer" })),
  ensureUserCredits: vi.fn(async () => undefined),
}));

describe("phone verification authorization boundary", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-server-key");
  });

  it.each([
    {
      label: "a forged profile flag",
      phone: undefined,
      confirmed: undefined,
      metadata: { signup_phone: "+64211234567", signup_phone_verified: true },
      expected: false,
    },
    {
      label: "an unconfirmed phone",
      phone: "64211234567",
      confirmed: undefined,
      metadata: { signup_phone_verified: true },
      expected: false,
    },
    {
      label: "a confirmation timestamp without a phone",
      phone: "",
      confirmed: "2026-10-28T00:00:00Z",
      metadata: {},
      expected: false,
    },
    {
      label: "a server-confirmed phone",
      phone: "64211234567",
      confirmed: "2026-10-28T00:00:00Z",
      metadata: { signup_phone_verified: false },
      expected: true,
    },
  ])(
    "uses server phone confirmation for $label",
    async ({ phone, confirmed, metadata, expected }) => {
      mocks.getUser.mockResolvedValue({
        data: {
          user: {
            id: "customer-1",
            email: "customer@example.com",
            email_confirmed_at: "2026-10-28T00:00:00Z",
            phone,
            phone_confirmed_at: confirmed,
            user_metadata: metadata,
          },
        },
        error: null,
      });
      const { supabaseAuthMiddleware } =
        await import("../middleware/supabaseAuth.js");
      const req = {
        headers: { authorization: "Bearer valid-test-token" },
        method: "GET",
        originalUrl: "/api/trpc/auth.me",
      } as Request;
      const res = {
        cookie: vi.fn(),
        clearCookie: vi.fn(),
        setHeader: vi.fn(),
      } as unknown as Response;
      const next = vi.fn();
      await supabaseAuthMiddleware(req, res, next);
      expect(next).toHaveBeenCalledOnce();
      expect(req.user?.id).toBe(42);
      expect(req.user?.phoneVerified).toBe(expected);
    },
  );
});
