import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("owner admin MFA security contract", () => {
  it("keeps the owner phone server-configured and out of client identity source", () => {
    const env = source("../../_core/env.ts");
    const ownerIdentity = source("../ownerIdentity.ts");

    expect(env).toContain('ownerPhone: process.env.OWNER_PHONE ?? ""');
    expect(env).not.toMatch(
      /ownerPhone:\s*process\.env\.OWNER_PHONE\s*\?\?\s*"\+\d+/,
    );
    expect(ownerIdentity).not.toContain("OWNER_PHONE");
    expect(ownerIdentity).not.toContain("canonicalOwnerPhone");
  });

  it("requires Twilio Verify and the fixed server-side owner phone for admin MFA", () => {
    const admin = source("../../routers/admin.ts");
    const twilio = source("../twilioSms.ts");

    expect(admin).toContain("mfaStatus: ownerAuthenticatedProcedure");
    expect(admin).toContain("requestMfa: ownerAuthenticatedProcedure");
    expect(admin).toContain("verifyMfa: ownerAuthenticatedProcedure");
    expect(admin).toContain("requestTwilioVerification(ENV.ownerPhone.trim())");
    expect(admin).toContain("checkTwilioVerification(");
    expect(admin).toContain("setAdminMfaCookie(ctx.req, ctx.res, ctx.user.id)");
    expect(twilio).toContain("/Verifications");
    expect(twilio).toContain("/VerificationCheck");
    expect(twilio).toContain('Channel: "sms"');
  });

  it("blocks every owner-only API until the session-bound MFA cookie is valid", () => {
    const trpc = source("../../_core/trpc.ts");
    const mfa = source("../adminMfa.ts");
    const middleware = source("../../middleware/supabaseAuth.ts");

    expect(trpc).toContain("export const ownerAuthenticatedProcedure");
    expect(trpc).toContain("export const ownerOnlyProcedure");
    expect(trpc).toContain("hasValidAdminMfa(opts.ctx.req, user.id)");
    expect(trpc).toContain("Admin SMS verification required");
    expect(mfa).toContain('const ADMIN_MFA_COOKIE = "appforge_admin_mfa"');
    expect(mfa).toContain("currentSessionFingerprint(req)");
    expect(mfa).toContain("currentUserAgentFingerprint(req)");
    expect(middleware).toContain("clearAdminMfaCookie(res)");
  });

  it("restricts the live SMS challenge workflow to the repository owner", () => {
    const challenge = source(
      "../../../.github/workflows/production-admin-mfa-challenge.yml",
    );

    expect(challenge).toContain("name: Production Admin MFA Challenge");
    expect(challenge).toContain("issue_comment");
    expect(challenge).toContain(
      "github.event.comment.user.login == github.repository_owner",
    );
    expect(challenge).toContain(
      "github.event.comment.body == '/gate1-admin-mfa request'",
    );
    expect(challenge).not.toContain("verification_code");
    expect(challenge).not.toContain("APPFORGE_ADMIN_MFA_CODE");
  });

  it("requires fresh completed physical MFA before launch evidence can pass", () => {
    const proof = source("../../../.github/workflows/production-admin-mfa.yml");

    expect(proof).toContain("name: Production Admin MFA");
    expect(proof).toContain("DATABASE_URL");
    expect(proof).toContain("FLY_API_TOKEN");
    expect(proof).toContain("admin_mfa_verify");
    expect(proof).toContain("approved");
    expect(proof).toContain("created_at >= to_timestamp");
    expect(proof).toContain("evidence_started_at");
    expect(proof).toContain("started_shas");
    expect(proof).not.toContain("verification_code");
    expect(proof).not.toContain("APPFORGE_ADMIN_MFA_CODE");
  });

  it("does not load admin data before SMS MFA succeeds", () => {
    const page = source("../../pages/Admin.tsx");

    expect(page).toContain("trpc.admin.mfaStatus.query()");
    expect(page).toContain("trpc.admin.requestMfa.mutate()");
    expect(page).toContain("trpc.admin.verifyMfa.mutate");
    expect(page).toContain("enabled: mfaStatus?.verified === true");
    expect(page).toContain("Admin verification");
    expect(page).toContain("Six-digit code");
    expect(page).toContain('aria-label="Admin SMS code"');
  });
});
