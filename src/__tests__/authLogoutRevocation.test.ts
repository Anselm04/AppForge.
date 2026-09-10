import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const auth = readFileSync(resolve(process.cwd(), "src/lib/auth.ts"), "utf8");
const client = readFileSync(
  resolve(process.cwd(), "src/lib/supabase-client.ts"),
  "utf8",
);

describe("logout session revocation", () => {
  it("clears local state and revokes only the current Supabase session", () => {
    expect(auth).toContain("const session = getSession()");
    expect(auth).toContain("removeStorage(SESSION_KEY)");
    expect(auth).toContain("supabaseClient.signOut(session.accessToken)");
    expect(client).toContain(
      'request<Record<string, never>>("/auth/v1/logout?scope=local"',
    );
    expect(client).toContain("Authorization: `Bearer ${accessToken}`");
    expect(client).not.toContain(
      'request<Record<string, never>>("/auth/v1/logout",',
    );
  });

  it("prevents an in-flight refresh from restoring a logged-out session", () => {
    expect(auth).toContain("let sessionGeneration = 0");
    expect(auth).toContain("const generationAtStart = sessionGeneration");
    expect(auth).toContain("generationAtStart !== sessionGeneration");
    expect(auth).toContain("sessionGeneration += 1");
  });

  it("does not reuse an expired access token after refresh fails", () => {
    const ensureStart = auth.indexOf(
      "export async function ensureFreshSession(): Promise<AppForgeSession | null>",
    );
    const signUpStart = auth.indexOf("export async function signUp", ensureStart);
    const ensureSource = auth.slice(ensureStart, signUpStart);

    expect(ensureSource).toContain("const refreshed = await refreshSession()");
    expect(ensureSource).toContain("if (refreshed) return refreshed");
    expect(ensureSource).toContain("signOut()");
    expect(ensureSource).toContain("return null");
    expect(ensureSource).not.toContain("return refreshed || getSession()");
  });
});
