import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AFTERCARE_PLUS_USD_CENTS,
  ENTERPRISE_MINIMUM_USD_CENTS,
  MONTHLY_PLAN_USD_CENTS,
} from "../services/appForgePricePolicy.js";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("repository instructions cannot reinstate historical stop-work orders", () => {
  it("keeps continuous engineering the active product direction", () => {
    const readme = read("README.md");
    const authority = read("docs/SOURCE_OF_TRUTH.md");
    const agents = read("AGENTS.md");
    expect(readme).toContain("Complete and continuously improve");
    expect(readme).toContain("Do not interpret old release handoffs");
    expect(authority).toContain("historical evidence");
    expect(agents).toContain("Complete the functioning builder");
  });

  it("marks superseded handoffs and audit findings as dated evidence", () => {
    for (const path of [
      "docs/APPFORGE_NO_SPEND_RELEASE_HANDOFF.md",
      "docs/APPFORGE_PROPOSED_PROFIT_FIRST_USD_PRICING.md",
      "docs/APPFORGE_LAUNCH_AUDIT_2026_11_08.md",
    ]) {
      const header = read(path).slice(0, 750);
      expect(header).toMatch(/HISTORICAL|SUPERSEDED|POINT-IN-TIME|ARCHIVED/);
      expect(header).toMatch(/not|NOT/);
    }
  });

  it("preserves the single approved price contract", () => {
    expect(MONTHLY_PLAN_USD_CENTS).toEqual({
      starter: 7900,
      builder: 19900,
      studio: 49900,
    });
    expect(ENTERPRISE_MINIMUM_USD_CENTS).toBe(249900);
    expect(AFTERCARE_PLUS_USD_CENTS).toBe(1900);
  });

  it("never confuses removing obsolete hold instructions with disabling customer protection", () => {
    const readme = read("README.md");
    expect(readme).toContain("Do not disable financial, privacy");
    expect(readme).toContain("Replace blanket availability gates");
    expect(readme).toContain("real deployment and aftercare");
  });
});
