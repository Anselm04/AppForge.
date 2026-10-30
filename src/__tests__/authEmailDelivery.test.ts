import { describe, expect, it, vi } from "vitest";
import { createSignupConfirmation } from "../services/authEmailDelivery.js";

describe("AppForge signup confirmation delivery", () => {
  it("creates one pending account with email and phone metadata, then sends the email confirmation", async () => {
    const generateLink = vi.fn(async () => ({
      actionLink: "https://project.supabase.co/auth/v1/verify?token=secret",
      userId: "user-123",
    }));
    const sendEmail = vi.fn(async () => undefined);
    const rollbackUser = vi.fn(async () => undefined);

    const result = await createSignupConfirmation(
      {
        email: "customer@example.com",
        phone: "+15551234567",
        password: "StrongPassword123!",
        redirectTo: "https://app.example.com/login?next=%2Faccount",
      },
      { generateLink, sendEmail, rollbackUser },
    );

    expect(generateLink).toHaveBeenCalledWith({
      email: "customer@example.com",
      phone: "+15551234567",
      password: "StrongPassword123!",
      redirectTo: "https://app.example.com/login?next=%2Faccount",
    });
    expect(sendEmail).toHaveBeenCalledWith({
      to: "customer@example.com",
      subject: "Confirm your AppForge email",
      confirmationUrl:
        "https://project.supabase.co/auth/v1/verify?token=secret",
    });
    expect(rollbackUser).not.toHaveBeenCalled();
    expect(result).toEqual({ userId: "user-123", confirmationSent: true });
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("rolls back the pending user when confirmation email delivery fails so signup can be retried cleanly", async () => {
    const generateLink = vi.fn(async () => ({
      actionLink: "https://project.supabase.co/auth/v1/verify?token=secret",
      userId: "user-123",
    }));
    const sendEmail = vi.fn(async () => {
      throw new Error("provider unavailable");
    });
    const rollbackUser = vi.fn(async () => undefined);

    await expect(
      createSignupConfirmation(
        {
          email: "customer@example.com",
          phone: "+15551234567",
          password: "StrongPassword123!",
          redirectTo: "https://app.example.com/login?next=%2Faccount",
        },
        { generateLink, sendEmail, rollbackUser },
      ),
    ).rejects.toThrow("provider unavailable");

    expect(rollbackUser).toHaveBeenCalledTimes(1);
    expect(rollbackUser).toHaveBeenCalledWith("user-123");
  });
});