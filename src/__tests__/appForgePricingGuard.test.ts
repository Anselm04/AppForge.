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
  unit_amount: 4900,
  recurring: { interval: "month", interval_count: 1 },
  livemode: true,
};
const credit = {
  active: true,
  currency: "usd",
  type: "one_time",
  unit_amount: 5000,
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
        assertAppForgePrice(invalid, 4900, "recurring", true),
      ).toThrow(/checkout paused/);
    }
  });

  it("prevents credit top-ups billed as subscriptions or discounted prices", () => {
    expect(() =>
      assertAppForgePrice(credit, TOPUP_USD_CENTS[50], "one_time", true),
    ).not.toThrow();
    for (const invalid of [
      { ...credit, unit_amount: 100 },
      { ...credit, type: "recurring" },
    ]) {
      expect(() =>
        assertAppForgePrice(invalid, 5000, "one_time", true),
      ).toThrow(/checkout paused/);
    }
  });

  it("verifies the policy before creating any payment session", () => {
    const checkout = readFileSync(
      resolve(process.cwd(), "src/services/stripeCheckout.ts"),
      "utf8",
    );
    expect(checkout).toContain("stripe.prices.retrieve(priceId)");
    expect(checkout).toContain(
      "assertAppForgePrice(price, MONTHLY_PLAN_USD_CENTS[tier]",
    );
    expect(checkout).toContain(
      "assertAppForgePrice(price, TOPUP_USD_CENTS[credits]",
    );
    expect(
      checkout.indexOf("assertAppForgePrice(price, MONTHLY_PLAN_USD_CENTS"),
    ).toBeLessThan(checkout.indexOf("stripe.checkout.sessions.create"));
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
  });
});
