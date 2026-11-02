import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const signUp = vi.hoisted(() => vi.fn());

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { signUp } }),
}));
vi.mock("../_core/env.js", () => ({
  ENV: {
    supabaseUrl: "https://project.supabase.co",
    supabaseServiceKey: "service-key",
  },
}));

import { createSignupConfirmation } from "../services/authEmailDelivery.js";

describe("AppForge signup confirmation delivery", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "public-key");
    signUp.mockReset();
  });

  afterEach(() => vi.unstubAllEnvs());

  it("creates one pending account with phone metadata and lets Supabase send confirmation", async () => {
    signUp.mockResolvedValue({
      data: { user: { id: "user-123" }, session: null },
      error: null,
    });

    const result = await createSignupConfirmation({
      email: "customer@example.com",
      phone: "+15551234567",
      password: "StrongPassword123!",
      redirectTo: "https://app.example.com/login?next=%2Faccount",
    });

    expect(signUp).toHaveBeenCalledWith({
      email: "customer@example.com",
      password: "StrongPassword123!",
      options: {
        emailRedirectTo: "https://app.example.com/login?next=%2Faccount",
        data: {
          signup_phone: "+15551234567",
          signup_phone_verified: false,
        },
      },
    });
    expect(result).toEqual({ userId: "user-123", confirmationSent: true });
  });

  it("reports provider signup failures instead of claiming confirmation was sent", async () => {
    signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "smtp_failure", message: "Confirmation delivery unavailable" },
    });

    await expect(
      createSignupConfirmation({
        email: "customer@example.com",
        phone: "+15551234567",
        password: "StrongPassword123!",
        redirectTo: "https://app.example.com/login?next=%2Faccount",
      }),
    ).rejects.toMatchObject({ code: "smtp_failure" });
  });
});