import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const route = readFileSync(
  resolve(process.cwd(), "src/routes/sso.ts"),
  "utf8",
);
const callback = readFileSync(
  resolve(process.cwd(), "src/pages/SsoCallback.tsx"),
  "utf8",
);

describe("SSO session handoff", () => {
  it("keeps access and refresh tokens out of redirect URLs", () => {
    expect(route).toContain('const SSO_SESSION_COOKIE = "appforge_sso_session"');
    expect(route).toContain('path: SSO_SESSION_PATH');
    expect(route).toContain('httpOnly: true');
    expect(route).toContain('signed: true');
    expect(route).toContain(
      'res.redirect(`/auth/sso/callback?next=${encodeURIComponent(next)}`)',
    );
    expect(route).not.toContain("?session=${sessionPayload}");
  });

  it("uses a one-time same-origin exchange in the SPA", () => {
    expect(callback).toContain('fetch("/api/sso/session"');
    expect(callback).toContain('credentials: "same-origin"');
    expect(callback).not.toContain('params.get("session")');
  });
});
