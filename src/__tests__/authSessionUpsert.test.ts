import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dbSource = readFileSync(
  resolve(process.cwd(), "src/db/linkUserFromAuth.ts"),
  "utf8",
);
const middleware = readFileSync(
  resolve(process.cwd(), "src/middleware/supabaseAuth.ts"),
  "utf8",
);
const authRoute = readFileSync(
  resolve(process.cwd(), "src/routes/auth.ts"),
  "utf8",
);
const server = readFileSync(resolve(process.cwd(), "src/server.ts"), "utf8");
const csrf = readFileSync(
  resolve(process.cwd(), "src/middleware/csrf.ts"),
  "utf8",
);
const home = readFileSync(resolve(process.cwd(), "src/pages/Home.tsx"), "utf8");
const clientAuth = readFileSync(
  resolve(process.cwd(), "src/lib/auth.ts"),
  "utf8",
);

describe("auth/session dogfood continuity", () => {
  it("links existing users by email when openId is new", () => {
    expect(dbSource).toContain("linkUserFromAuth");
    expect(dbSource).toContain("where: eq(schema.users.email, email)");
    expect(dbSource).toMatch(/byEmail/);
    expect(middleware).toContain('await import("../db/linkUserFromAuth.js")');
  });

  it("returns 200 on session sync and 500 on upsert failure", () => {
    expect(middleware).toContain("status(200)");
    expect(middleware).toContain('code: "SESSION_UPSERT_FAILED"');
    expect(middleware).toContain("supabase_auth_session_cookies_set");
  });

  it("exposes GET /api/auth/me for SPA cookie/bearer hydration", () => {
    expect(authRoute).toContain('code: "AUTH_REQUIRED"');
    expect(authRoute).toContain("supabaseUid");
    expect(server).toContain('app.use("/api/auth", authRouter)');
  });

  it("uses SameSite=Lax for CSRF and auth cookies", () => {
    expect(csrf).toContain('sameSite: "lax"');
    expect(middleware).toContain('sameSite: "lax"');
  });

  it("does not bounce Generate to login while a SPA bearer exists", () => {
    expect(home).toContain("if (getAccessToken())");
    expect(home).toContain("if (!user && !getAccessToken())");
    expect(clientAuth).toContain('"/api/auth/me"');
    expect(clientAuth).toContain("Preserve an existing SPA bearer");
  });
});
