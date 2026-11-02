import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const signUp = vi.hoisted(() => vi.fn());
const resetPasswordForEmail = vi.hoisted(() => vi.fn());

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      signUp,
      resetPasswordForEmail,
      resend: vi.fn(),
    },
  }),
}));
vi.mock("../_core/env.js", () => ({
  ENV: {
    supabaseUrl: "https://identity.example.com",
    supabaseServiceKey: "test-key",
  },
}));

import {
  createSignupConfirmation,
  sendPasswordRecovery,
} from "../services/authEmailDelivery.js";

describe("Supabase authentication email destinations", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "public-key");
    signUp.mockReset();
    resetPasswordForEmail.mockReset();
    signUp.mockResolvedValue({
      data: { user: { id: "identity-1" }, session: null },
      error: null,
    });
    resetPasswordForEmail.mockResolvedValue({ error: null });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("keeps signup confirmation on the app and preserves the intended destination", async () => {
    const result = await createSignupConfirmation({
      email: "customer@example.com",
      phone: "+15551234567",
      password: "Password123!",
      redirectTo: "https://app.example.com/login?next=%2Faccount",
    });

    expect(signUp).toHaveBeenCalledWith({
      email: "customer@example.com",
      password: "Password123!",
      options: {
        emailRedirectTo: "https://app.example.com/login?next=%2Faccount",
        data: {
          signup_phone: "+15551234567",
          signup_phone_verified: false,
        },
      },
    });
    expect(result).toEqual({ userId: "identity-1", confirmationSent: true });
  });

  it("sends password recovery to the password-reset page through Supabase Auth", async () => {
    await sendPasswordRecovery({
      email: "customer@example.com",
      redirectTo: "https://app.example.com/password-reset",
    });

    expect(resetPasswordForEmail).toHaveBeenCalledWith("customer@example.com", {
      redirectTo: "https://app.example.com/password-reset",
    });
  });

  it("does not expose an unknown recovery account", async () => {
    resetPasswordForEmail.mockResolvedValue({
      error: { code: "user_not_found", message: "User not found" },
    });

    await expect(
      sendPasswordRecovery({
        email: "unknown@example.com",
        redirectTo: "https://app.example.com/password-reset",
      }),
    ).resolves.toBeUndefined();
  });

  it("reports real Supabase recovery delivery failures rather than claiming success", async () => {
    resetPasswordForEmail.mockResolvedValue({
      error: { code: "smtp_failure", message: "SMTP unavailable" },
    });

    await expect(
      sendPasswordRecovery({
        email: "customer@example.com",
        redirectTo: "https://app.example.com/password-reset",
      }),
    ).rejects.toMatchObject({ code: "smtp_failure" });
  });
});