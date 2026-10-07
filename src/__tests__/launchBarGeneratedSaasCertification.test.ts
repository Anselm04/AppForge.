import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("launch bar #5 generated SaaS certification", () => {
  const production = readFileSync(
    "src/services/productionAutoDeploy.ts",
    "utf8",
  );

  it("requires persisted auth and tenant-isolation evidence before certification", () => {
    expect(production).toContain("authLifecycleRequired");
    expect(production).toContain("authLifecycleVerified");
    expect(production).toContain("tenantIsolationRequired");
    expect(production).toContain("tenantIsolationVerified");
    expect(production).toContain("generated_saas_safety_evidence_persist_failed");
    expect(production).toContain("Production certification blocked: required generated SaaS safety evidence could not be persisted");
  });

  it("blocks paid SaaS certification when deployed billing lifecycle verification is not green", () => {
    expect(production).toContain("if (!billing.ok)");
    expect(production).toContain("Production certification blocked by deployed billing lifecycle verification");
    expect(production).toContain("billingLifecycleVerified: true");
  });
});
