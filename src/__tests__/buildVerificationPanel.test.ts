import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("customer-visible verification record contract", () => {
  const buildPage = readFileSync("src/pages/Build.tsx", "utf8");
  const evidenceApi = readFileSync("src/db.ts", "utf8");

  it("exposes current artifact verification in the existing evidence tab", () => {
    expect(buildPage).toContain("engineering-verification-record");
    expect(buildPage).toContain("evidence.engineeringVerification.checks.map");
    expect(buildPage).toContain(
      "evidence.stackCapabilityContract.requiredChecks.map",
    );
    expect(evidenceApi).toContain("buildEngineeringVerificationRecord({");
    expect(evidenceApi).toContain("stackCapabilityContract:");
  });
});
