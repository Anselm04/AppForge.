import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const middleware = readFileSync(
  resolve(process.cwd(), "src/middleware/supabaseAuth.ts"),
  "utf8",
);

describe("Supabase server authentication boundary", () => {
  it(
    "validates bearer or cookie tokens with Supabase before trusting identity",
    () => {
      expect(middleware).toContain('header.match(/^Bearer\\s+(.+)$/i)');
      expect(middleware).toContain("await supabase.auth.getUser(token)");
      expect(middleware).toContain("if (error || !data.user)");
    },
  );

  it("never accepts access tokens from query parameters", () => {
    expect(middleware).not.toContain("req.query.token");
    expect(middleware).not.toContain("req.query.access_token");
  });

  it(
    "fails closed in production when the Supabase auth client is unavailable",
    () => {
      expect(middleware).toContain('if (process.env.NODE_ENV === "production")');
      expect(middleware).toContain('code: "AUTH_UNAVAILABLE"');
      expect(middleware).toContain("return res.status(503)");
    },
  );

  it("uses hardened server session cookies", () => {
    expect(middleware).toContain("httpOnly: true");
    expect(middleware).toContain('sameSite: "strict"');
    expect(middleware).toContain(
      'secure: process.env.NODE_ENV === "production"',
    );
    expect(middleware).toContain('res.setHeader("Cache-Control", "no-store")');
  });

  it("derives AppForge identity from the verified Supabase user", () => {
    expect(middleware).toContain("const supabaseUid = data.user.id");
    expect(middleware).toContain("await upsertUserFromAuth({");
    expect(middleware).toContain("openId: supabaseUid");
    expect(middleware).toContain("req.user = {");
  });
});
