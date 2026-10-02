import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const auth = readFileSync(resolve(process.cwd(), "src/lib/auth.ts"), "utf8");
const client = readFileSync(
  resolve(process.cwd(), "src/lib/supabase-client.ts"),
  "utf8",
);
const middleware = readFileSync(
  resolve(process.cwd(), "src/middleware/supabaseAuth.ts"),
  "utf8",
);
const account = readFileSync(
  resolve(process.cwd(), "src/pages/Account.tsx"),
  "utf8",
);

describe("logout session revocation", () => {
  it("clears local state and revokes only the current Supabase session", () => {
    expect(auth).toContain("const session = getSession()");
    expect(auth).toContain("clearStoredUser()");
    expect(auth).toContain("void clearServerSession(session?.accessToken)");
    expect(auth).toContain("supabaseClient.signOut(session.accessToken)");
    expect(client).toContain(
      'request<Record<string, never>>("/auth/v1/logout?scope=local"',
    );
    expect(client).toContain("Authorization: `Bearer ${accessToken}`");
    expect(client).not.toContain(
      'request<Record<string, never>>("/auth/v1/logout",',
    );
  });

  it("supports server-backed revocation for other devices and all devices", () => {
    expect(auth).toContain(
      'type SessionRevocationScope = "local" | "others" | "global"',
    );
    expect(auth).toContain(
      'await revokeServerSessions("others", session?.accessToken)',
    );
    expect(auth).toContain(
      'await revokeServerSessions("global", session?.accessToken)',
    );
    expect(auth).toContain("clearLocalSessionState()");

    expect(middleware).toContain(
      'type SignOutScope = "local" | "others" | "global"',
    );
    expect(middleware).toContain(
      "/auth/v1/logout?scope=${encodeURIComponent(scope)}",
    );
    expect(middleware).toContain('sessionDeleteScope !== "others"');
    expect(middleware).toContain('code: "SESSION_REVOCATION_FAILED"');

    expect(account).toContain("signOutOtherDevices");
    expect(account).toContain("signOutAllDevices");
    expect(account).toContain("Sign out other devices");
    expect(account).toContain("Sign out all devices");
  });

  it("fails closed for invalid or unavailable scoped session revocation", () => {
    expect(middleware).toContain('code: "INVALID_SIGN_OUT_SCOPE"');
    expect(middleware).toContain(
      'sessionDeleteScope === "others" || sessionDeleteScope === "global"',
    );
    expect(middleware).toContain('code: "AUTH_UNAVAILABLE"');
  });

  it("keeps refresh credentials out of browser-managed session storage", () => {
    expect(auth).toContain('const USER_KEY = "appforge.user"');
    expect(auth).toContain('const ACCESS_TOKEN_KEY = "appforge.access-token"');
    expect(auth).toContain("sessionStorage");
    expect(auth).not.toContain('const SESSION_KEY = "appforge.session"');
    expect(auth).not.toContain("refreshToken?: string;");
  });

  it("falls back to GET /api/auth/me when the SPA bearer is missing or expired", () => {
    const ensureStart = auth.indexOf(
      "export async function ensureFreshSession(): Promise<AppForgeSession | null>",
    );
    const signUpStart = auth.indexOf(
      "export async function signUp",
      ensureStart,
    );
    const ensureSource = auth.slice(ensureStart, signUpStart);

    expect(ensureSource).toContain(
      "if (session?.accessToken && !accessTokenExpired(session.accessToken))",
    );
    expect(ensureSource).toContain("const hydrated = await refreshSession()");
    expect(ensureSource).toContain("return hydrated");
    expect(auth).toContain('fetch("/api/auth/me"');
    expect(ensureSource).not.toContain("clearStoredAccessToken()");
  });

  it("does not expose raw Supabase 5xx responses to the UI", () => {
    expect(client).toContain("if (response.status >= 500)");
    expect(client).toContain(
      'throw new Error("Authentication service is temporarily unavailable.")',
    );
    expect(client).not.toContain(
      "`Supabase request failed: ${response.status}`",
    );
  });
});
