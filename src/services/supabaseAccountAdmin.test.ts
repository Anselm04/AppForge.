import { describe, expect, it, vi } from "vitest";
const getUserById = vi.hoisted(() => vi.fn());
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { admin: { getUserById } } }),
}));
vi.mock("../_core/env.js", () => ({
  ENV: {
    supabaseUrl: "https://identity.example.com",
    supabaseServiceKey: "test-key",
  },
}));
import { getSupabaseAccountIdentity } from "./supabaseAccountAdmin.js";

describe("service account identity resolution", () => {
  it("resolves confirmation from the provider for a service-authenticated caller", async () => {
    getUserById.mockResolvedValue({
      data: {
        user: {
          id: "identity-1",
          email_confirmed_at: "2026-01-01",
          phone: "+15551234567",
          phone_confirmed_at: "2026-01-01",
        },
      },
      error: null,
    });
    await expect(getSupabaseAccountIdentity("identity-1")).resolves.toEqual({
      supabaseUid: "identity-1",
      phone: "+15551234567",
      phoneVerified: true,
    });
  });

  it("does not let editable phone metadata elevate service access", async () => {
    getUserById.mockResolvedValue({
      data: {
        user: {
          id: "identity-1",
          email_confirmed_at: "2026-01-01",
          user_metadata: { signup_phone_verified: true },
        },
      },
      error: null,
    });
    expect((await getSupabaseAccountIdentity("identity-1")).phoneVerified).toBe(
      false,
    );
  });

  it.each([
    { id: "another-identity", email_confirmed_at: "2026-01-01" },
    { id: "identity-1", confirmed_at: "2026-01-01" },
  ])("rejects mismatched or unconfirmed identities", async (user) => {
    getUserById.mockResolvedValue({ data: { user }, error: null });
    await expect(getSupabaseAccountIdentity("identity-1")).rejects.toThrow(
      /confirmed account identity/i,
    );
  });
});
