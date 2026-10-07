import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("mandatory login verification contract", () => {
  it("does not treat primary Supabase credentials as a complete AppForge login", () => {
    const pendingLogin = source("src/lib/verifiedLogin.ts");
    const login = source("src/pages/Login.tsx");

    expect(pendingLogin).toContain("beginPasswordSignIn");
    expect(pendingLogin).toContain("completeVerifiedLogin");
    expect(pendingLogin).not.toContain(
      "rememberAuthenticatedUser(result.user)",
    );
    expect(login).toContain("trpc.auth.requestLoginVerification.mutate()");
    expect(login).toContain("trpc.auth.verifyLoginVerification.mutate");
    expect(login).toContain("Verification code");
  });

  it("requires verified phone possession on every protected AppForge boundary", () => {
    const trpc = source("src/_core/trpc.ts");
    const rest = source("src/middleware/requireAuthenticatedUser.ts");
    const router = source("src/routers/index.ts");

    expect(trpc).toContain("hasValidLoginMfa");
    expect(trpc).toContain("Phone verification required");
    expect(rest).toContain("hasValidLoginMfa");
    expect(rest).toContain("PHONE_VERIFICATION_REQUIRED");
    expect(router).toContain("requestLoginVerification");
    expect(router).toContain("verifyLoginVerification");
  });

  it("collects a real name and mobile number at signup and binds them to the account", () => {
    const signup = source("src/pages/Signup.tsx");
    const delivery = source("src/services/authEmailDelivery.ts");

    expect(signup).toContain('name="full-name"');
    expect(signup).toContain('name="phone"');
    expect(delivery).toContain("fullName");
    expect(delivery).toContain("phone");
    expect(delivery).toContain("data:");
  });

  it("never exposes owner identity through auth.me before login verification", () => {
    const router = source("src/routers/index.ts");
    expect(router).toContain(
      "hasValidLoginMfa(opts.ctx.req, user.supabaseUid)",
    );
    expect(router).toContain("clearLoginMfaCookie(ctx.res)");
  });
});
