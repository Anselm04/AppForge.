import { describe, expect, it } from "vitest";
import {
  minimumPriceForMargin,
  evaluateProvisionalProviderBudget,
} from "../lib/providerCostPolicy.js";

describe("AppForge USD profitability calculator (offline only)", () => {
  it("prices actual worst-case variable costs, support and overhead before target margin", () => {
    // $10 AI + $10 human support + $15 shared cost, 5.5% card/FX
    // provision and a 30% post-fee contribution target.
    const cents = minimumPriceForMargin({
      worstCaseProviderCents: 1000,
      supportAndLabourCents: 1000,
      allocatedOverheadCents: 1500,
      paymentFeeBasisPoints: 550,
      targetContributionMarginBasisPoints: 3000,
    });
    expect(cents).toBe(5427);
  });

  it("refuses impossible costs or margins rather than issuing a loss-making quote", () => {
    const quote = {
      worstCaseProviderCents: 1200,
      supportAndLabourCents: 1000,
      allocatedOverheadCents: 500,
      paymentFeeBasisPoints: 550,
      targetContributionMarginBasisPoints: 3000,
    };
    expect(() =>
      minimumPriceForMargin({ ...quote, worstCaseProviderCents: -1 }),
    ).toThrow(/Invalid unit economics/);
    expect(() =>
      minimumPriceForMargin({ ...quote, targetContributionMarginBasisPoints: 9800 }),
    ).toThrow(/Invalid unit economics/);
    expect(() =>
      minimumPriceForMargin({ ...quote, worstCaseProviderCents: Number.NaN }),
    ).toThrow(/Invalid unit economics/);
  });

  it("counts in-flight reservations as spent and pauses when allowance is depleted", () => {
    const result = evaluateProvisionalProviderBudget({
      tier: "starter",
      usedCents: 850,
      pendingCents: 200,
      estimatedWorstCaseNewCents: 250,
    });
    expect(result.availableCents).toBe(150);
    expect(result.permittedByModel).toBe(false);
    expect(result.reason).toContain("pause and quote");
  });

  it("does not treat free access or a zero-priced billable call as authorised", () => {
    expect(
      evaluateProvisionalProviderBudget({
        tier: "free",
        usedCents: 0,
        pendingCents: 0,
        estimatedWorstCaseNewCents: 1,
      }).permittedByModel,
    ).toBe(false);
    expect(
      evaluateProvisionalProviderBudget({
        tier: "studio",
        usedCents: 0,
        pendingCents: 0,
        estimatedWorstCaseNewCents: 0,
      }).permittedByModel,
    ).toBe(false);
  });
});
