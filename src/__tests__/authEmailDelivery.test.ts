import { describe, expect, it, vi } from "vitest";
import { createSignupConfirmation } from "../services/authEmailDelivery.js";

describe("AppForge signup confirmation delivery", () => {
  it("creates a Supabase confirmation link and sends it through Twilio Email without returning the secret link", async () => {
    const generateLink = vi.fn(async () => ({
      actionLink: "https://project.supabase.co/auth/v1/verify?token=secret",
      userId: "user-123",
    }));
    const sendEmail = vi.fn(async () => undefined);

    const result = await createSignupConfirmation(
      {
        email: "customer@example.com",
        password: "StrongPassword123!",
        redirectTo: "https://app.example.com/login?next=%2Faccount",
      },
      { generateLink, sendEmail },
    );

    expect(generateLink).toHaveBeenCalledWith({
      email: "customer@example.com",
      password: "StrongPassword123!",
      redirectTo: "https://app.example.com/login?next=%2Faccount",
    });
    expect(sendEmail).toHaveBeenCalledWith({
      to: "customer@example.com",
      subject: "Confirm your AppForge email",
      confirmationUrl:
        "https://project.supabase.co/auth/v1/verify?token=secret",
    });
    expect(result).toEqual({ userId: "user-123", confirmationSent: true });
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("fails closed when email delivery fails", async () => {
    const generateLink = vi.fn(async () => ({
      actionLink: "https://project.supabase.co/auth/v1/verify?token=secret",
      userId: "user-123",
    }));
    const sendEmail = vi.fn(async () => {
      throw new Error("provider unavailable");
    });

    await expect(
      createSignupConfirmation(
        {
          email: "customer@example.com",
          password: "StrongPassword123!",
          redirectTo: "https://app.example.com/login?next=%2Faccount",
        },
        { generateLink, sendEmail },
      ),
    ).rejects.toThrow("provider unavailable");
  });
});
