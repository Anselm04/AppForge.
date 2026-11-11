import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("local HTTPS startup", () => {
  const launcher = readFileSync(
    "scripts/start-local-fullstack.mjs",
    "utf8",
  );

  it("requires real HTTPS production origins", () => {
    expect(launcher).toContain("trustedOrigin = value.origin");
    expect(launcher).toContain("APP_URL: trustedOrigin");
    expect(launcher).toContain("PUBLIC_APP_URL: trustedOrigin");
    expect(launcher).toContain("CORS_ORIGIN: allowedOrigins.join");
  });

  it("does not replace production URLs with HTTP localhost", () => {
    expect(launcher).not.toContain("APP_URL: \"http://");
    expect(launcher).toContain("BIND_HOST: \"127.0.0.1\"");
  });
});
