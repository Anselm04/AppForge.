import { describe, expect, it } from "vitest";
import {
  calculateOpportunityScore,
  recommendOpportunity,
  sanitizeEvidenceRefs,
} from "../lib/marketIntelligence.js";

describe("market intelligence scoring", () => {
  it("calculates the documented deterministic weighted score", () => {
    expect(
      calculateOpportunityScore({
        demand: 90,
        monetization: 80,
        differentiation: 70,
        marketingReach: 60,
        competition: 40,
      }),
    ).toBe(75);
  });

  it("clamps component scores before calculating the final score", () => {
    expect(
      calculateOpportunityScore({
        demand: 150,
        monetization: -20,
        differentiation: 100,
        marketingReach: 100,
        competition: -10,
      }),
    ).toBe(80);
  });

  it("maps opportunity scores to explicit recommendations", () => {
    expect(recommendOpportunity(80)).toBe("BUILD");
    expect(recommendOpportunity(60)).toBe("VALIDATE_MORE");
    expect(recommendOpportunity(39)).toBe("DO_NOT_BUILD");
  });
});

describe("market intelligence evidence references", () => {
  it("removes references that do not exist in the returned source set", () => {
    expect(sanitizeEvidenceRefs([1, 2, 999, 2, -1], new Set([1, 2, 3]))).toEqual([
      1, 2,
    ]);
  });
});
