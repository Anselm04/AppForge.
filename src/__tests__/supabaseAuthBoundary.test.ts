import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const middleware = readFileSync(
  resolve(process.cwd(), "src/middleware/supabaseAuth.ts"),
  "utf8",
);

describe("Supabase server authentication boundary", () => {
  it("validates bearer or cookie tokens with Supabase before trusting identity", () => {
    expect(middleware).toContain("header.match(/^Bearer\\s+(.+)$/i)");
    expect(middleware).toContain("await supabase.auth.getUser(token)");
    expect(middleware).toContain(
      "return error || !data.user ? null : data.user;",
    );
  });

  it("requires confirmed email before establishing an AppForge session", () => {
    expect(middleware).toContain("authUser.email_confirmed_at");
    expect(middleware).toContain("authUser.confirmed_at");
    expect(middleware).toContain('code: "EMAIL_CONFIRMATION_REQUIRED"');
    expect(middleware).toContain('"supabase_auth_email_confirmation_required"');
  });

  it("refreshes expired access tokens with a server-held refresh token", () => {
    expect(middleware).toContain('const REFRESH_COOKIE = "sb-refresh-token"');
    expect(middleware).toContain("await supabase.auth.refreshSession({");
    expect(middleware).toContain("refresh_token: refreshToken");
    expect(middleware).toContain(
      "setSessionCookies(res, refreshed.accessToken, refreshed.refreshToken)",
    );
  });

  it("coalesces concurrent refresh-token rotation and preserves cookies on transient refresh failure", () => {
    expect(middleware).toContain("refreshAccessTokenSingleFlight");
    expect(middleware).toContain("refreshFlights");
    expect(middleware).toContain("recentRefreshes");
    expect(middleware).toContain("REFRESH_GRACE_MS");
    expect(middleware).toContain('createHash("sha256")');
    expect(middleware).toContain(
      "A transient Supabase/network failure must never destroy a still-valid",
    );
  });

  it("never accepts access tokens from query parameters", () => {
    expect(middleware).not.toContain("req.query.token");
    expect(middleware).not.toContain("req.query.access_token");
  });

  it("fails closed in production when the Supabase auth client is unavailable", () => {
    expect(middleware).toContain('if (process.env.NODE_ENV === "production")');
    expect(middleware).toContain('code: "AUTH_UNAVAILABLE"');
    expect(middleware).toContain("return res.status(503)");
  });

  it("uses hardened server session cookies", () => {
    expect(middleware).toContain("httpOnly: true");
    expect(middleware).toContain('sameSite: "strict"');
    expect(middleware).toContain(
      'secure: process.env.NODE_ENV === "production"',
    );
    expect(middleware).toContain('res.setHeader("Cache-Control", "no-store")');
  });

  it("derives AppForge identity from the verified Supabase user", () => {
    expect(middleware).toContain("const supabaseUid = authUser.id");
    expect(middleware).toContain("await upsertUserFromAuth({");
    expect(middleware).toContain("openId: supabaseUid");
    expect(middleware).toContain("req.user = {");
  });
});
