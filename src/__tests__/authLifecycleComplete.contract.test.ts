import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("complete AppForge authentication lifecycle", () => {
  it("creates email/password accounts with an optional phone on the same pending identity", () => {
    const signup = source("src/pages/Signup.tsx");
    const auth = source("src/lib/auth.ts");
    const delivery = source("src/services/authEmailDelivery.ts");

    expect(signup).toContain('id="signup-email"');
    expect(signup).toContain('id="signup-phone"');
    expect(signup).toContain('label="Mobile number (optional)"');
    expect(signup).toContain('id="signup-password"');
    expect(signup).toContain(
      "await signUp(email.trim(), normalizedPhone, password, next);",
    );
    expect(auth).toContain('phone.trim() ? normalizePhone(phone) : ""');
    expect(auth).not.toContain('    normalizePhone(phone),\n    password,');
    expect(delivery).toContain("signup_phone: input.phone");
    expect(delivery).toContain("signup_phone_verified: false");
    expect(signup).not.toContain("navigate(`/verify-phone?next=");
    expect(signup).toContain("navigate(next, { replace: true });");
  });

  it("permits confirmed customers without SMS and keeps owner privilege checks", () => {
    const gate = source("src/components/auth/RequireAuth.tsx");
    const trpc = source("src/_core/trpc.ts");
    const login = source("src/pages/Login.tsx");
    const restGate = source("src/middleware/requireAuthenticatedUser.ts");
    const signupRoute = source("src/routes/health.ts");

    expect(gate).not.toContain("if (!me.phoneVerified)");
    const protectedBlock = trpc
      .split("export const protectedProcedure", 2)[1]
      ?.split("export const accountDeletionProcedure", 1)[0];
    expect(protectedBlock).not.toContain("if (!user.phoneVerified)");
    expect(restGate).not.toContain("PHONE_VERIFICATION_REQUIRED");
    expect(login).toContain("user?.isOwner && user.phoneVerified !== true");
    expect(trpc).toContain("if (!user.phoneVerified)");
    expect(signupRoute).toContain("phoneVerificationRequired: false");
  });

  it("lets an authenticated account attach a phone without letting the browser choose the verification target later", () => {
    const router = source("src/routers/index.ts");
    const service = source("src/services/accountPhoneVerification.ts");
    const page = source("src/pages/VerifyPhone.tsx");

    expect(router).toContain("requestAccountPhoneVerification({");
    expect(router).toContain("supabaseUid: ctx.user.supabaseUid");
    expect(router).toContain("phone: input?.phone");
    expect(router).toContain("verifyAccountPhone({");
    expect(router).not.toContain(
      "phone: ctx.user.phone,\n          code: input.code",
    );
    expect(service).toContain(
      "await supabase.auth.admin.getUserById(input.supabaseUid)",
    );
    expect(service).toContain("const phone = storedPhone(current.user)");
    expect(service).toContain("await checkTwilioVerification(phone, code)");
    expect(page).toContain('id="phone-enrollment-number"');
    expect(page).toContain('id="phone-verification-code"');
  });

  it("requires a fresh browser-session proof before cookies can restore authentication", () => {
    const auth = source("src/lib/auth.ts");
    const middleware = source("src/middleware/supabaseAuth.ts");

    expect(auth).toContain(
      'const BROWSER_SESSION_KEY = "appforge.browser-session"',
    );
    expect(auth).toContain("if (!hasBrowserSession()) return null;");
    expect(auth).toContain("clearBrowserSession();");
    expect(middleware).toContain(
      'const BROWSER_SESSION_HEADER = "x-appforge-browser-session"',
    );
    expect(middleware).toContain(
      "if (!hasBrowserSessionProof(req)) return undefined;",
    );
  });

  it("keeps owner admin access behind a separate SMS MFA gate without blocking normal verified-account APIs", () => {
    const trpc = source("src/_core/trpc.ts");
    const admin = source("src/lib/adminMfa.ts");
    const login = source("src/pages/Login.tsx");
    const gate = source("src/components/auth/RequireAuth.tsx");
    const protectedBlock = trpc
      .split("export const protectedProcedure", 2)[1]
      ?.split("export const accountDeletionProcedure", 1)[0];
    const ownerOnlyBlock = trpc.split("export const ownerOnlyProcedure", 2)[1];

    expect(protectedBlock).toBeTruthy();
    expect(protectedBlock).not.toContain("hasValidAdminMfa");
    expect(protectedBlock).not.toContain("if (!user.phoneVerified)");
    expect(ownerOnlyBlock).toContain("hasValidAdminMfa(opts.ctx.req, user.id)");
    expect(ownerOnlyBlock).toContain(
      'message: "Admin SMS verification required"',
    );
    expect(login).toContain("function isAdminDestination(next: string)");
    expect(login).toContain("isAdminDestination(next)");
    expect(login).toContain("return next;");
    expect(gate).not.toContain("ownerMfaVerified");
    expect(gate).not.toContain("/admin?next=");
    expect(admin).toContain("admin");
  });
});
