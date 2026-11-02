import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("AppForge authentication provider roles", () => {
  it("uses Supabase Auth for authentication email lifecycle and never Twilio Email", () => {
    const delivery = source("src/services/authEmailDelivery.ts");

    expect(delivery).toContain("auth.signUp");
    expect(delivery).toContain("auth.resend");
    expect(delivery).toContain("auth.resetPasswordForEmail");
    expect(delivery).not.toContain("sendTwilioEmail");
    expect(delivery).not.toContain("requireTwilioEmailConfig");
    expect(delivery).not.toContain("requireTwilioAuthEmailHookConfig");
  });

  it("keeps Twilio Verify SMS in the production gate but removes obsolete auth-email secrets", () => {
    const deploy = source(".github/workflows/deploy-production.yml");

    expect(deploy).toContain("TWILIO_VERIFY_SERVICE_SID");
    expect(deploy).toContain("TWILIO_ACCOUNT_SID");
    expect(deploy).toContain("TWILIO_AUTH_TOKEN");
    expect(deploy).not.toContain("SUPABASE_SEND_EMAIL_HOOK_SECRET");
    expect(deploy).not.toContain("TWILIO_EMAIL_FROM");
    expect(deploy).not.toContain("APPFORGE_EMAIL_FROM");
  });

  it("does not require owner admin MFA for ordinary protected builder procedures", () => {
    const trpc = source("src/_core/trpc.ts");
    const protectedBlock = trpc
      .split("export const protectedProcedure", 2)[1]
      ?.split("export const accountDeletionProcedure", 1)[0];

    expect(protectedBlock).toBeTruthy();
    expect(protectedBlock).toContain("if (!user.phoneVerified)");
    expect(protectedBlock).not.toContain("hasValidAdminMfa");
  });
});
