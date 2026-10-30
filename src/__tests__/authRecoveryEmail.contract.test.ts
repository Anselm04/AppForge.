import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("AppForge password recovery email contract", () => {
  it("generates recovery links server-side and sends them through Cloudflare Email", () => {
    const delivery = source("src/services/authEmailDelivery.ts");
    expect(delivery).toContain('type: "recovery"');
    expect(delivery).toContain("supabase.auth.admin.generateLink");
    expect(delivery).toContain("sendCloudflareEmail");
    expect(source("src/services/cloudflareEmail.ts")).toContain(
      "https://api.cloudflare.com/client/v4/accounts/",
    );
    expect(delivery).not.toContain("twilio");
    expect(delivery).toContain('subject: "Reset your AppForge password"');
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
