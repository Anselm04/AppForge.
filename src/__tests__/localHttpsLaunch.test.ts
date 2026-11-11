import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("local HTTPS startup", () => {
  const launcher = readFileSync("scripts/start-local-fullstack.mjs", "utf8");

  it("requires the actual HTTPS production origin", () => {
    expect(launcher).toContain("trustedOrigin = value.origin");
    expect(launcher).toContain("APP_URL: trustedOrigin");
    expect(launcher).toContain("PUBLIC_APP_URL: trustedOrigin");
    expect(launcher).toContain("CORS_ORIGIN: allowedOrigins.join");
  });

  it("does not silently use insecure HTTP loopback", () => {
    expect(launcher).not.toContain("http://127.0.0.1:3000");
    expect(launcher).toContain("value.protocol");
  });
});
