import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const auth = readFileSync(resolve(process.cwd(), "src/lib/auth.ts"), "utf8");
const client = readFileSync(
  resolve(process.cwd(), "src/lib/supabase-client.ts"),
  "utf8",
);

describe("logout session revocation", () => {
  it("clears local state and revokes the current Supabase access token", () => {
    expect(auth).toContain("const session = getSession()");
    expect(auth).toContain("removeStorage(SESSION_KEY)");
    expect(auth).toContain("supabaseClient.signOut(session.accessToken)");
    expect(client).toContain('request<Record<string, never>>("/auth/v1/logout"');
    expect(client).toContain("Authorization: `Bearer ${accessToken}`");
  });

  it("prevents an in-flight refresh from restoring a logged-out session", () => {
    expect(auth).toContain("let sessionGeneration = 0");
    expect(auth).toContain("const generationAtStart = sessionGeneration");
    expect(auth).toContain("generationAtStart !== sessionGeneration");
    expect(auth).toContain("sessionGeneration += 1");
  });
});
