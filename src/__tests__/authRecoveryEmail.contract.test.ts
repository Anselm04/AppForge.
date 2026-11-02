import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("AppForge password recovery email contract", () => {
  it("lets Supabase Auth own recovery token creation and email delivery", () => {
    const delivery = source("src/services/authEmailDelivery.ts");
    expect(delivery).toContain("auth.resetPasswordForEmail");
    expect(delivery).toContain("redirectTo: input.redirectTo");
    expect(delivery).not.toContain("auth.admin.generateLink");
    expect(delivery).not.toContain("sendTwilioEmail");
    expect(delivery).not.toContain("SUPABASE_SEND_EMAIL_HOOK_SECRET");
    expect(delivery).not.toContain("TWILIO_EMAIL_FROM");
  });

  it("keeps password recovery on the rate-limited same-origin auth endpoint", () => {
    const client = source("src/lib/supabase-client.ts");
    const route = source("src/routes/authSignup.ts");
    expect(client).toContain('purpose: "password_recovery"');
    expect(client).toContain("/api/health/auth-resend-verification");
    expect(route).toContain('req.body?.purpose === "password_recovery"');
    expect(route).toContain("signupAbuseLimiter");
    expect(route).toContain("passwordRecoveryRedirect()");
  });

  it("never trusts a request Host header for the recovery destination", () => {
    const redirect = source("src/services/authRedirect.ts");
    expect(redirect).toContain("PUBLIC_APP_URL");
    expect(redirect).toContain("APP_URL");
    expect(redirect).toContain("passwordRecoveryRedirect");
    expect(redirect).not.toContain("req.headers.host");
  });
});
