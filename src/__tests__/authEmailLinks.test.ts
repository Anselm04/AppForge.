import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const generateLink = vi.hoisted(() => vi.fn());
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { admin: { generateLink } } }),
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

describe("email confirmation and recovery destinations", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "a".repeat(32));
    vi.stubEnv("CLOUDFLARE_EMAIL_API_TOKEN", "cloudflare-test-token");
    vi.stubEnv("APPFORGE_EMAIL_FROM", "support@example.com");
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ delivered: ["customer@example.com"], queued: [] }),
        { status: 200 },
      ),
    );
    generateLink.mockResolvedValue({
      data: {
        properties: {
          hashed_token: "one-time-token",
          action_link: "https://identity.example.com/wrong-default-destination",
        },
        user: { id: "identity-1" },
      },
      error: null,
    });
  });

  function sentEmail() {
    const init = vi.mocked(fetch).mock.calls[0][1]!;
    return JSON.parse(init.body as string) as { text: string };
  }

  it("keeps confirmation on the app and preserves the intended destination", async () => {
    const result = await createSignupConfirmation({
      email: "customer@example.com",
      phone: "+15551234567",
      password: "Password123!",
      redirectTo: "https://app.example.com/login?next=%2Faccount",
    });
    expect(sentEmail().text).toContain(
      "https://app.example.com/login?next=%2Faccount&token_hash=one-time-token&type=signup",
    );
    expect(sentEmail().text).not.toContain("wrong-default-destination");
    expect(JSON.stringify(result)).not.toContain("one-time-token");
  });

  it("sends password recovery to the password-reset page", async () => {
    await sendPasswordRecovery({
      email: "customer@example.com",
      redirectTo: "https://app.example.com/password-reset",
    });
    expect(generateLink).toHaveBeenCalledWith(
      expect.objectContaining({ type: "recovery" }),
    );
    expect(sentEmail().text).toContain(
      "https://app.example.com/password-reset?token_hash=one-time-token&type=recovery",
    );
  });

  it("does not send a recovery email for an unknown account", async () => {
    generateLink.mockResolvedValue({
      data: null,
      error: { code: "user_not_found" },
    });
    await expect(
      sendPasswordRecovery({
        email: "unknown@example.com",
        redirectTo: "https://app.example.com/password-reset",
      }),
    ).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports rejected email delivery rather than claiming success", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));
    await expect(
      sendPasswordRecovery({
        email: "customer@example.com",
        redirectTo: "https://app.example.com/password-reset",
      }),
    ).rejects.toThrow(/delivery failed/i);
  });
});
