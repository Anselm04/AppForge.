import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const twilioSms = readFileSync(
  resolve(process.cwd(), "src/lib/twilioSms.ts"),
  "utf8",
);
const env = readFileSync(
  resolve(process.cwd(), "src/_core/env.ts"),
  "utf8",
);

describe("Twilio Verify integration", () => {
  it("supports a Twilio Verify Service SID", () => {
    expect(env).toContain("TWILIO_VERIFY_SERVICE_SID");
    expect(twilioSms).toContain("verify.twilio.com/v2/Services");
    expect(twilioSms).toContain('Channel: "sms"');
    expect(twilioSms).toContain("CustomCode");
  });

  it("preserves the legacy Twilio phone-number sender as a fallback", () => {
    expect(twilioSms).toContain("ENV.twilioVerifyServiceSid || ENV.twilioPhoneNumber");
    expect(twilioSms).toContain("Messages.json");
  });
});
