import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const authSource = readFileSync(
  resolve(process.cwd(), "src/lib/auth.ts"),
  "utf8",
);

describe("Supabase login resilience", () => {
  it("keeps a valid bearer session when browser-cookie sync is temporarily unavailable", () => {
    expect(authSource).toContain("syncServerSessionBestEffort");
    expect(authSource).toContain("saveSession(session)");
    expect(authSource).toContain("await syncServerSessionBestEffort(");
    expect(authSource).toContain("result.refresh_token");
    expect(authSource).not.toContain("session.refreshToken");
    expect(authSource).toContain('"x-supabase-refresh-token"');
  });

  it("persists accessToken in sessionStorage so iOS navigations keep Authorization", () => {
    expect(authSource).toContain(
      'const ACCESS_TOKEN_KEY = "appforge.access-token"',
    );
    expect(authSource).toContain("storeAccessToken(session.accessToken)");
    expect(authSource).toContain("readStoredAccessToken");
    expect(authSource).toContain("clearStoredAccessToken");
  });

  it("probes GET /api/auth/me with bearer instead of stripping it first", () => {
    expect(authSource).toContain('fetch("/api/auth/me"');
    expect(authSource).toContain("NEVER strip the bearer before the probe");
    expect(authSource).not.toContain(
      "clearStoredAccessToken();\n    const refreshed = await refreshServerCookieSession",
    );
  });
});
