import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("AppForge finite credits and tier-limit invariants", () => {
  const db = readFileSync(resolve(process.cwd(), "src/db.ts"), "utf8");
  const subscriptions = readFileSync(
    resolve(process.cwd(), "src/routers/subscriptions.ts"),
    "utf8",
  );

  it("preserves intentionally contract-defined Studio and Enterprise limits", () => {
    expect(db).toMatch(/studio:\s*null,\s*enterprise:\s*null/);
    expect(db).toContain(
      "Object.prototype.hasOwnProperty.call(TIER_BUILD_LIMITS, tier)",
    );
    expect(db).toContain(
      "Object.prototype.hasOwnProperty.call(TIER_CREDIT_REFILLS, tier)",
    );
    expect(subscriptions).toContain(
      "Object.prototype.hasOwnProperty.call(TIER_LIMITS, tier)",
    );
  });

  it("does not issue free plan monthly AI credits or included build slots", () => {
    expect(db).toMatch(/TIER_BUILD_LIMITS[^]*?free:\s*0/);
    expect(db).toMatch(/TIER_CREDIT_REFILLS[^]*?free:\s*0/);
    expect(subscriptions).toMatch(/TIER_LIMITS[^]*?free:\s*0/);
  });

  it("keeps abstract credits separate from actual verified provider spend", () => {
    const pricing = readFileSync(
      resolve(
        process.cwd(),
        "docs/APPFORGE_PROPOSED_PROFIT_FIRST_USD_PRICING.md",
      ),
      "utf8",
    );
    expect(pricing).toContain("per-tenant and per-job provider cost metering");
    expect(pricing).toContain("not a guarantee");
  });
});
