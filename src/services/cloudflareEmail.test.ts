import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendCloudflareEmail } from "./cloudflareEmail.js";
const input = {
  to: "customer@example.com",
  subject: "Verify",
  text: "Confirm your account",
  html: "<p>Confirm your account</p>",
};
describe("Cloudflare transactional email", () => {
  beforeEach(() => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "a".repeat(32));
    vi.stubEnv("CLOUDFLARE_EMAIL_API_TOKEN", "cloudflare-test-token");
    vi.stubEnv("APPFORGE_EMAIL_FROM", "support@example.com");
  });
  afterEach(() => vi.unstubAllEnvs());
  it.each(["delivered", "queued"])(
    "accepts an explicitly %s recipient",
    async (state) => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ [state]: [input.to] }), { status: 200 }),
      );
      await expect(sendCloudflareEmail(input)).resolves.toBeUndefined();
      expect(fetch).toHaveBeenCalledWith(
        `https://api.cloudflare.com/client/v4/accounts/${"a".repeat(32)}/email/sending/send`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer cloudflare-test-token",
          }),
          body: JSON.stringify({
            from: { address: "support@example.com", name: "AppForge" },
            ...input,
          }),
        }),
      );
    },
  );
  it("never claims delivery for a bounced or suppressed recipient", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          delivered: [],
          queued: [],
          permanent_bounces: [input.to],
        }),
        { status: 200 },
      ),
    );
    await expect(sendCloudflareEmail(input)).rejects.toThrow(/did not accept/);
  });
  it("fails closed when only Twilio credentials are configured", async () => {
    vi.stubEnv("CLOUDFLARE_EMAIL_API_TOKEN", "");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "");
    vi.stubEnv("TWILIO_ACCOUNT_SID", "test-twilio-account");
    await expect(sendCloudflareEmail(input)).rejects.toThrow(
      /Cloudflare email sending is not configured/,
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not expose provider response details on a rejected send", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("private provider detail", { status: 403 }),
    );
    await expect(sendCloudflareEmail(input)).rejects.toThrow(
      "Cloudflare email delivery failed.",
    );
  });
});
