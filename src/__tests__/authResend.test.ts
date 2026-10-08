import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const resend = vi.hoisted(() => vi.fn());
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { resend } }),
}));
vi.mock("../_core/env.js", () => ({
  ENV: { supabaseUrl: "https://project.supabase.co" },
}));
import { resendSignupConfirmation } from "../services/authEmailDelivery.js";

describe("verification resend preserves the signup identity", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_ANON_KEY", "public-key");
    resend.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());
  const input = {
    email: "person@example.com",
    redirectTo: "https://app.example/login?next=%2F",
  };
  it("resends signup verification without generating a user or replacing its password", async () => {
    resend.mockResolvedValue({ error: null });
    await resendSignupConfirmation(input);
    expect(resend).toHaveBeenCalledWith({
      type: "signup",
      email: input.email,
      options: { emailRedirectTo: input.redirectTo },
    });
  });
  it.each(["user_not_found", "email_not_found", "email_already_confirmed"])(
    "does not expose account status %s",
    async (code) => {
      resend.mockResolvedValue({ error: { code } });
      await expect(resendSignupConfirmation(input)).resolves.toBeUndefined();
    },
  );
  it("fails closed on delivery failures", async () => {
    resend.mockResolvedValue({ error: new Error("SMTP unavailable") });
    await expect(resendSignupConfirmation(input)).rejects.toThrow(
      "SMTP unavailable",
    );
  });
  it("does not contact the provider without a configured public credential", async () => {
    vi.stubEnv("SUPABASE_ANON_KEY", "");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    await expect(resendSignupConfirmation(input)).rejects.toThrow(
      "not configured",
    );
    expect(resend).not.toHaveBeenCalled();
  });
});
