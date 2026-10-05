import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("capability persistence contract", () => {
  it("stores provider state in shared durable app settings", () => {
    const store = source("src/capabilities/store.ts");
    expect(store).toContain("schema.appSettings");
    expect(store).toContain("capability_provider:");
    expect(store).toContain("onConflictDoUpdate");
  });

  it("stores audits and incidents in durable compliance records", () => {
    const store = source("src/capabilities/store.ts");
    expect(store).toContain('recordType: "capability_audit"');
    expect(store).toContain('recordType: "capability_security_incident"');
    expect(store).toContain("sanitizeCapabilityMetadata");
  });
});
