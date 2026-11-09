import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertAppForgePrice,
  MONTHLY_PLAN_USD_CENTS,
  TOPUP_USD_CENTS,
} from "../services/appForgePricePolicy.js";

const monthly = {
  active: true,
  currency: "usd",
  type: "recurring",
  unit_amount: 7900,
  recurring: { interval: "month", interval_count: 1 },
  livemode: true,
};
const credit = {
  active: true,
  currency: "usd",
  type: "one_time",
  unit_amount: 10000,
  recurring: null,
  livemode: true,
};

describe("AppForge margin-protective checkout terms", () => {
  it("only accepts exact published USD monthly subscription prices", () => {
    expect(() =>
      assertAppForgePrice(
        monthly,
        MONTHLY_PLAN_USD_CENTS.starter,
        "recurring",
        true,
      ),
    ).not.toThrow();
    for (const invalid of [
      { ...monthly, unit_amount: 1900 },
      { ...monthly, currency: "nzd" },
      { ...monthly, recurring: { interval: "year", interval_count: 1 } },
      { ...monthly, livemode: false },
      { ...monthly, active: false },
    ]) {
      expect(() =>
        assertAppForgePrice(invalid, 7900, "recurring", true),
      ).toThrow(/checkout paused/);
    }
  });

  it("enforces the approved owner prices for every self-service tier", () => {
    expect(MONTHLY_PLAN_USD_CENTS).toEqual({
      starter: 7900,
      builder: 19900,
      studio: 49900,
    });
    for (const amount of Object.values(MONTHLY_PLAN_USD_CENTS)) {
      expect(() =>
        assertAppForgePrice(
          { ...monthly, unit_amount: amount },
          amount,
          "recurring",
          true,
        ),
      ).not.toThrow();
    }
    expect(() =>
      assertAppForgePrice(
        { ...monthly, unit_amount: 4900 },
        MONTHLY_PLAN_USD_CENTS.starter,
        "recurring",
        true,
      ),
    ).toThrow(/checkout paused/);
  });

  it("prevents credit top-ups billed as subscriptions or discounted prices", () => {
    expect(() =>
      assertAppForgePrice(credit, TOPUP_USD_CENTS[50], "one_time", true),
    ).not.toThrow();
    for (const invalid of [
      { ...credit, unit_amount: 1000 },
      { ...credit, type: "recurring" },
    ]) {
      expect(() =>
        assertAppForgePrice(invalid, 10000, "one_time", true),
      ).toThrow(/checkout paused/);
    }
  });

  it("verifies the policy before creating any payment session", () => {
    const checkout = readFileSync(
      resolve(process.cwd(), "src/services/stripeCheckout.ts"),
      "utf8",
    );
    expect(checkout).toContain("stripe.prices.retrieve(priceId)");
    expect(checkout).toMatch(
      /assertAppForgePrice\(\s*price,\s*MONTHLY_PLAN_USD_CENTS\[tier\]/,
    );
    expect(checkout).toMatch(
      /assertAppForgePrice\(\s*price,\s*TOPUP_USD_CENTS\[credits\]/,
    );
    const policyIndex = checkout.indexOf("assertAppForgePrice");
    expect(policyIndex).toBeGreaterThanOrEqual(0);
    expect(policyIndex).toBeLessThan(
      checkout.indexOf("stripe.checkout.sessions.create"),
    );
  });

  it("warns customers that mid-cycle top-ups are a separate purchase", () => {
    const pricing = readFileSync(
      resolve(process.cwd(), "src/pages/Pricing.tsx"),
      "utf8",
    );
    const landing = readFileSync(
      resolve(process.cwd(), "src/pages/LandingPage.tsx"),
      "utf8",
    );
    expect(pricing).toContain("before your next monthly subscription payment");
    expect(pricing).toContain("must separately purchase");
    expect(pricing).toContain("Top-ups are never automatic");
    expect(landing).toContain("before your next monthly subscription payment");
    expect(landing).toContain("must buy extra top-up credits separately");
  });

  it("blocks creation and redemption of new unlimited lifetime codes", () => {
    const admin = readFileSync(
      resolve(process.cwd(), "src/routers/admin.ts"),
      "utf8",
    );
    expect(admin).toContain("New unlimited lifetime codes are disabled");
    expect(admin).toContain(
      "Legacy lifetime codes require owner-assisted review",
    );
    const database = readFileSync(resolve(process.cwd(), "src/db.ts"), "utf8");
    expect(database).toContain(
      "Unlimited AppForge credit grants are owner-only",
    );
  });
});
