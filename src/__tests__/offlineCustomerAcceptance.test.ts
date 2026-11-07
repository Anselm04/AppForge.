import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { balanceAfterMonthlyGrant } from "../lib/creditRollover.js";
import { creditsExhaustedBody } from "../lib/credits.js";
import { assertEligibleForCreditTopUp } from "../services/appForgeCreditEligibility.js";
import {
  assertAppForgePrice,
  MONTHLY_PLAN_USD_CENTS,
} from "../services/appForgePricePolicy.js";
import { assertCommercialCheckoutReleased } from "../services/appForgeCommercialCheckoutGate.js";
import { assertCustomerComputeLaunchCertified } from "../services/customerComputeLaunchGate.js";
import {
  evaluateProvisionalProviderBudget,
  minimumPriceForMargin,
} from "../lib/providerCostPolicy.js";

describe("zero-spend customer acceptance: actual commercial policy helpers", () => {
  it("does not advertise unapproved top-up prices as final customer charges", () => {
    const page = readFileSync(
      resolve(process.cwd(), "src/pages/Pricing.tsx"),
      "utf8",
    );
    expect(page).toMatch(/USD price awaiting\s+approval/);
    expect(page).toMatch(
      /Top-up purchases are unavailable until the exact USD prices/,
    );
    expect(page).toContain(
      "disabled={PRICING_PROPOSAL_MODE || buyCredits.isPending}",
    );
    expect(page).not.toContain("USD ${(pack * 2)");
  });

  it("advertised plans have the approved USD amounts", () => {
    expect(MONTHLY_PLAN_USD_CENTS).toEqual({
      starter: 4900,
      builder: 14900,
      studio: 39900,
    });
    for (const [tier, cents] of Object.entries(MONTHLY_PLAN_USD_CENTS)) {
      expect(cents).toBeGreaterThan(0);
      expect(tier).toMatch(/^(starter|builder|studio)$/);
      assertAppForgePrice(
        {
          active: true,
          currency: "usd",
          unit_amount: cents,
          type: "recurring",
          recurring: { interval: "month", interval_count: 1 },
          livemode: false,
        },
        cents,
        "recurring",
        false,
      );
    }
  });

  it("refuses incorrect currency, amount, inactive price, or wrong billing interval", () => {
    const valid = {
      active: true,
      currency: "usd",
      unit_amount: 4900,
      type: "recurring",
      recurring: { interval: "month", interval_count: 1 },
      livemode: false,
    };
    for (const bad of [
      { currency: "nzd" },
      { unit_amount: 7900 },
      { active: false },
      { recurring: { interval: "year", interval_count: 1 } },
    ]) {
      expect(() =>
        assertAppForgePrice({ ...valid, ...bad }, 4900, "recurring", false),
      ).toThrow(/checkout paused/);
    }
    expect(() => assertAppForgePrice(valid, 4900, "recurring", true)).toThrow();
  });

  it("preserves prepaid unused credits across monthly refills", () => {
    expect(balanceAfterMonthlyGrant(37, 100)).toBe(137);
    expect(balanceAfterMonthlyGrant(137, 100)).toBe(237);
    expect(() =>
      balanceAfterMonthlyGrant(Number.MAX_SAFE_INTEGER, 1),
    ).toThrow();
    expect(() => balanceAfterMonthlyGrant(-1, 100)).toThrow();
  });

  it("pauses exhausted work without silently charging a top-up", () => {
    const message = creditsExhaustedBody(0, 5, "finish your build");
    expect(message.code).toBe("credits_exhausted");
    expect(message.balance).toBe(0);
    expect(message.cost).toBe(5);
    expect(message.message).toContain("No automatic top-up charges");
    expect(message.message).toContain("stays paused");
  });

  it("requires current paid eligibility for customer top-up checkout", () => {
    const now = new Date("2026-11-06T00:00:00Z");
    expect(() =>
      assertEligibleForCreditTopUp(
        {
          tier: "starter",
          status: "active",
          currentPeriodEnd: new Date("2026-12-01T00:00:00Z"),
        },
        now,
      ),
    ).not.toThrow();
    for (const status of ["canceled", "past_due", "unpaid", "incomplete"]) {
      expect(() =>
        assertEligibleForCreditTopUp({ tier: "starter", status }, now),
      ).toThrow();
    }
    expect(() =>
      assertEligibleForCreditTopUp({ tier: "free", status: "active" }, now),
    ).toThrow();
  });

  it("does not allow production checkout or unqualified customer AI calls", () => {
    for (const runtime of [
      "production",
      "preview",
      "staging",
      "",
      "Production",
    ]) {
      expect(() => assertCommercialCheckoutReleased(runtime)).toThrow();
      expect(() =>
        assertCustomerComputeLaunchCertified(false, runtime),
      ).toThrow();
    }
    expect(() => assertCommercialCheckoutReleased("test")).not.toThrow();
    expect(() =>
      assertCustomerComputeLaunchCertified(false, "test"),
    ).not.toThrow();
  });

  it("denies provisional provider work when allowance is exhausted", () => {
    const result = evaluateProvisionalProviderBudget({
      tier: "starter",
      usedCents: 900,
      pendingCents: 250,
      estimatedWorstCaseNewCents: 100,
    });
    expect(result.permittedByModel).toBe(false);
    expect(result.availableCents).toBe(50);
    expect(
      minimumPriceForMargin({
        worstCaseProviderCents: 1000,
        supportAndLabourCents: 1000,
        allocatedOverheadCents: 1500,
        paymentFeeBasisPoints: 550,
        targetContributionMarginBasisPoints: 3000,
      }),
    ).toBe(5427);
  });
});
