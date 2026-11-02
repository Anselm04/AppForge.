import { describe, expect, it, vi } from "vitest";
vi.mock("./twilioEmail.js", () => ({
  requireTwilioAuthEmailHookConfig: vi.fn(),
}));
vi.mock("../_core/env.js", () => ({
  ENV: {
    supabaseUrl: "https://identity.example.com",
    supabaseServiceKey: "test-key",
  },
}));
import {
  requestAccountReauthentication,
  updateAccountCredentials,
} from "./accountCredentials.js";

describe("provider credential updates", () => {
  it("uses the customer JWT with the provider user endpoint", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));
    await updateAccountCredentials("customer-token", {
      email: "new@example.com",
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://identity.example.com/auth/v1/user",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          Authorization: "Bearer customer-token",
        }),
        body: JSON.stringify({ email: "new@example.com" }),
      }),
    );
  });

  it("fails when the provider rejects a session", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));
    await expect(
      updateAccountCredentials("expired-token", {
        password: "NewPassword123!",
      }),
    ).rejects.toThrow(/sign in again/i);
  });

  it("keeps provider diagnostics out of the API error", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("private diagnostic", { status: 500 }),
    );
    await expect(
      updateAccountCredentials("customer-token", { email: "new@example.com" }),
    ).rejects.toThrow(
      "Unable to update account credentials. Check your details and try again.",
    );
  });

  it("requests a password verification code for the authenticated session", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));
    await requestAccountReauthentication("customer-token");
    expect(fetch).toHaveBeenCalledWith(
      "https://identity.example.com/auth/v1/reauthenticate",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer customer-token",
        }),
      }),
    );
  });

  it.each(["code", "error_code"])(
    "handles provider %s when secure password change requires verification",
    async (field) => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ [field]: "reauthentication_needed" }), {
          status: 400,
        }),
      );
      await expect(
        updateAccountCredentials("customer-token", {
          password: "NewPassword123!",
        }),
      ).rejects.toThrow(/password verification code/);
    },
  );
});
