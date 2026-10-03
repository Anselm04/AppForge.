import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("admin MFA security contract", () => {
  it("requires SMS MFA for every owner-only admin procedure", () => {
    const trpc = source("../_core/trpc.ts");
    const admin = source("../routers/admin.ts");

    expect(trpc).toContain("ownerAuthenticatedProcedure");
    expect(trpc).toContain("hasValidAdminMfa");
    expect(trpc).toContain("Admin SMS verification required");
    expect(admin).toContain("mfaStatus: ownerAuthenticatedProcedure");
    expect(admin).toContain("requestMfa: ownerAuthenticatedProcedure");
    expect(admin).toContain("verifyMfa: ownerAuthenticatedProcedure");
    expect(admin).toContain("me: ownerOnlyProcedure");
    expect(admin).toContain("analytics: ownerOnlyProcedure");
    expect(admin).toContain("operations: ownerOnlyProcedure");
  });

  it("binds the admin MFA cookie to the current user, primary session and user agent", () => {
    const mfa = source("../lib/adminMfa.ts");

    expect(mfa).toContain("payload.uid !== userId");
    expect(mfa).toContain("payload.session !== session");
    expect(mfa).toContain("payload.ua !== currentUserAgentFingerprint(req)");
    expect(mfa).toContain("ADMIN_MFA_TTL_MS = 15 * 60 * 1000");
    expect(mfa).toContain("timingSafeEqual");
    expect(mfa).toContain('sameSite: "strict"');
    expect(mfa).toContain("httpOnly: true");
  });

  it("uses Twilio Verify without exposing the owner phone to the browser or source defaults", () => {
    const twilio = source("../lib/twilioSms.ts");
    const env = source("../_core/env.ts");
    const identity = source("../lib/ownerIdentity.ts");
    const admin = source("../routers/admin.ts");

    expect(twilio).toContain("requestTwilioVerification");
    expect(twilio).toContain("checkTwilioVerification");
    expect(admin).toContain("ENV.ownerPhone.trim()");
    expect(admin).toContain("maskedOwnerPhone()");
    expect(env).toContain('ownerPhone: process.env.OWNER_PHONE ?? ""');
    expect(identity).not.toContain("OWNER_PHONE");
  });

  it("clears admin MFA on logout and rate-limits challenge endpoints", () => {
    const routers = source("../routers/index.ts");
    const server = source("../server.ts");

    expect(routers).toContain("clearAdminMfaCookie(ctx.res)");
    expect(server).toContain("adminMfaRequestLimiter");
    expect(server).toContain("adminMfaVerifyLimiter");
    expect(server).toContain('/api/trpc/admin.requestMfa');
    expect(server).toContain('/api/trpc/admin.verifyMfa');
  });

  it("renders no admin data until the SMS challenge is verified", () => {
    const page = source("../pages/Admin.tsx");

    expect(page).toContain('queryKey: ["admin", "mfaStatus"]');
    expect(page).toContain("enabled: mfaStatus?.verified === true");
    expect(page).toContain("Send SMS verification code");
    expect(page).toContain("Verify and enter admin");
  });
});
