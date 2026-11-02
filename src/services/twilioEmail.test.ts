import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendTwilioEmail } from "./twilioEmail.js";

const input = {
  to: "customer@example.com",
  subject: "Verify",
  text: "Confirm your account",
  html: "<p>Confirm your account</p>",
};

describe("Twilio transactional email", () => {
  beforeEach(() => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", "AC" + "a".repeat(32));
    vi.stubEnv("TWILIO_AUTH_TOKEN", "twilio-test-token");
    vi.stubEnv("TWILIO_EMAIL_FROM", "accounts@example.com");
    vi.stubEnv("APPFORGE_EMAIL_FROM", "");
    vi.stubEnv("OWNER_EMAIL", "private-owner@example.com");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("submits the customer's email to Twilio using server credentials and a product sender", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ operationId: "send-1" }), { status: 202 }),
    );
    await expect(sendTwilioEmail(input)).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(
      "https://comms.twilio.com/v1/Emails",
      expect.objectContaining({
        method: "POST",
        redirect: "error",
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from(`AC${"a".repeat(32)}:twilio-test-token`).toString("base64")}`,
        }),
        body: JSON.stringify({
          from: { address: "accounts@example.com", name: "AppForge" },
          to: [{ address: input.to }],
          content: {
            subject: input.subject,
            text: input.text,
            html: input.html,
          },
        }),
      }),
    );
    expect(JSON.stringify(vi.mocked(fetch).mock.calls)).not.toContain(
      "private-owner@example.com",
    );
  });

  it("keeps the existing explicit APPFORGE_EMAIL_FROM sender compatible", async () => {
    vi.stubEnv("TWILIO_EMAIL_FROM", "");
    vi.stubEnv("APPFORGE_EMAIL_FROM", "support@example.com");
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ operationId: "send-2" }), { status: 202 }),
    );
    await sendTwilioEmail(input);
    expect(
      JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string).from
        .address,
    ).toBe("support@example.com");
  });

  it("never uses the owner's private inbox as an implicit sender", async () => {
    vi.stubEnv("TWILIO_EMAIL_FROM", "");
    await expect(sendTwilioEmail(input)).rejects.toThrow(
      /Twilio email sending is not configured/,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([200, 400, 401, 429, 500])(
    "does not claim Twilio accepted an email for HTTP %s",
    async (status) => {
      vi.mocked(fetch).mockResolvedValue(
        new Response("private provider detail", { status }),
      );
      await expect(sendTwilioEmail(input)).rejects.toThrow(
        "Twilio email delivery failed.",
      );
    },
  );

  it("does not treat an empty accepted response as an operation confirmation", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 202 }));
    await expect(sendTwilioEmail(input)).rejects.toThrow(
      "Twilio did not acknowledge the email operation.",
    );
  });
});
