import { describe, expect, it } from "vitest";
import { assertEligibleForCreditTopUp } from "../services/appForgeCreditEligibility.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const now = new Date("2026-11-06T00:00:00.000Z");

describe("AppForge credit top-up billing eligibility", () => {
  it("allows separately paid credits only under an active paid plan", () => {
    for (const tier of ["starter", "builder", "studio"]) {
      expect(() =>
        assertEligibleForCreditTopUp(
          { tier, status: "active", currentPeriodEnd: new Date("2026-11-30") },
          now,
        ),
      ).not.toThrow();
    }
  });

  it("rejects free accounts and expired or cancelled subscriptions", () => {
    for (const subscription of [
      undefined,
      { tier: "free", status: "active" },
      { tier: "starter", status: "canceled" },
      { tier: "builder", status: "past_due" },
      {
        tier: "studio",
        status: "active",
        currentPeriodEnd: new Date("2026-11-01"),
      },
      {
        tier: "starter",
        status: "trialing",
        trialEnd: new Date("2026-11-01"),
      },
    ]) {
      expect(() => assertEligibleForCreditTopUp(subscription, now)).toThrow(
        /active paid AppForge subscription/,
      );
    }
  });

  it("checks entitlement before creating a paid credit checkout", () => {
    const checkout = readFileSync(
      resolve(process.cwd(), "src/services/stripeCheckout.ts"),
      "utf8",
    );
    const topUp = checkout.slice(
      checkout.indexOf("export async function createCreditCheckout"),
    );
    expect(topUp.indexOf("assertEligibleForCreditTopUp(sub)")).toBeGreaterThan(
      0,
    );
    expect(topUp.indexOf("assertEligibleForCreditTopUp(sub)")).toBeLessThan(
      topUp.indexOf("stripe.checkout.sessions.create"),
    );
  });
});
