import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("trusted ingress proxy boundary", () => {
  const server = readFileSync("src/server.ts", "utf8");

  it("never trusts arbitrary public X-Forwarded-For addresses", () => {
    expect(server).not.toContain('app.set("trust proxy", true)');
    expect(server).toContain("APPFORGE_TRUSTED_PROXY_CIDRS");
    expect(server).toContain('"loopback"');
  });
});
