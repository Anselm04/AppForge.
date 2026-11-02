import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resend = vi.hoisted(() => vi.fn());
const signUp = vi.hoisted(() => vi.fn());
const resetPasswordForEmail = vi.hoisted(() => vi.fn());

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      resend,
      signUp,
      resetPasswordForEmail,
    },
  }),
}));
vi.mock("../_core/env.js", () => ({
  ENV: {
    supabaseUrl: "https://project.supabase.co",
    supabaseServiceKey: "service-key",
  },
}));

import {
  createSignupConfirmation,
  resendSignupConfirmation,
  sendPasswordRecovery,
} from "../services/authEmailDelivery.js";

describe("Supabase-native authentication email lifecycle", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_ANON_KEY", "public-key");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "public-key");
    resend.mockReset();
    signUp.mockReset();
    resetPasswordForEmail.mockReset();
  });

  afterEach(() => vi.unstubAllEnvs());

  const resendInput = {
    email: "person@example.com",
    redirectTo: "https://app.example/login?next=%2F",
  };

  it("creates the pending account through Supabase Auth and preserves the phone as unverified metadata", async () => {
    signUp.mockResolvedValue({
      data: {
        user: { id: "identity-1" },
        session: null,
      },
      error: null,
    });

    const result = await createSignupConfirmation({
      email: "person@example.com",
      phone: "+64211234567",
      password: "strong-password",
      redirectTo: "https://app.example/login?next=%2F",
    });

    expect(signUp).toHaveBeenCalledWith({
      email: "person@example.com",
      password: "strong-password",
      options: {
        emailRedirectTo: "https://app.example/login?next=%2F",
        data: {
          signup_phone: "+64211234567",
          signup_phone_verified: false,
        },
      },
    });
    expect(result).toEqual({ userId: "identity-1", confirmationSent: true });
  });

  it("does not require Twilio Email credentials for signup", async () => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", "");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "");
    vi.stubEnv("TWILIO_EMAIL_FROM", "");
    vi.stubEnv("APPFORGE_EMAIL_FROM", "");
    vi.stubEnv("SUPABASE_SEND_EMAIL_HOOK_SECRET", "");
    signUp.mockResolvedValue({
      data: { user: { id: "identity-1" }, session: null },
      error: null,
    });

    await expect(
      createSignupConfirmation({
        email: "person@example.com",
        phone: "+64211234567",
        password: "strong-password",
        redirectTo: "https://app.example/login?next=%2F",
      }),
    ).resolves.toEqual({ userId: "identity-1", confirmationSent: true });
  });

  it("resends signup verification without generating a user or replacing its password", async () => {
    resend.mockResolvedValue({ error: null });
    await resendSignupConfirmation(resendInput);
    expect(resend).toHaveBeenCalledWith({
      type: "signup",
      email: resendInput.email,
      options: { emailRedirectTo: resendInput.redirectTo },
    });
  });

  it.each(["user_not_found", "email_not_found", "email_already_confirmed"])(
    "does not expose account status %s",
    async (code) => {
      resend.mockResolvedValue({ error: { code } });
      await expect(
        resendSignupConfirmation(resendInput),
      ).resolves.toBeUndefined();
    },
  );

  it("fails closed on resend delivery failures", async () => {
    resend.mockResolvedValue({ error: new Error("SMTP unavailable") });
    await expect(resendSignupConfirmation(resendInput)).rejects.toThrow(
      "SMTP unavailable",
    );
  });

  it("requests password recovery through Supabase Auth without exposing account existence", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });
    await sendPasswordRecovery(resendInput);
    expect(resetPasswordForEmail).toHaveBeenCalledWith(resendInput.email, {
      redirectTo: resendInput.redirectTo,
    });
  });

  it.each(["user_not_found", "email_not_found"])(
    "does not expose password recovery account status %s",
    async (code) => {
      resetPasswordForEmail.mockResolvedValue({
        error: { code, message: "not found" },
      });
      await expect(sendPasswordRecovery(resendInput)).resolves.toBeUndefined();
    },
  );

  it("does not contact Supabase without a configured public credential", async () => {
    vi.stubEnv("SUPABASE_ANON_KEY", "");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    await expect(resendSignupConfirmation(resendInput)).rejects.toThrow(
      "not configured",
    );
    expect(resend).not.toHaveBeenCalled();
  });
});
