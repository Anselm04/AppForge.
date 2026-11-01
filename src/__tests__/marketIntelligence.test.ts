import { describe, expect, it } from "vitest";
import {
  calculateOpportunityScore,
  recommendOpportunity,
  sanitizeAnalysisEvidence,
  sanitizeEvidenceRefs,
  type MarketIntelligenceAnalysis,
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
    expect(
      sanitizeEvidenceRefs([1, 2, 999, 2, -1], new Set([1, 2, 3])),
    ).toEqual([1, 2]);
  });

  it(
    "drops optional claims when all of their evidence references are invalid",
    () => {
      const analysis: MarketIntelligenceAnalysis = {
        summary: { text: "Supported summary", evidence: [1] },
        positioning: { text: "Supported positioning", evidence: [1] },
        customerPains: [
          { text: "Supported pain", evidence: [1] },
          { text: "Unsupported pain", evidence: [999] },
        ],
        featureGaps: [],
        marketingHooks: [],
        monetization: [],
        risks: [],
        scores: {
          demand: 50,
          monetization: 50,
          differentiation: 50,
          marketingReach: 50,
          competition: 50,
        },
        confidence: "medium",
        buildBrief:
          "Build a sufficiently detailed evidence-backed product brief.",
        audience: "test audience",
      };

      const sanitized = sanitizeAnalysisEvidence(analysis, new Set([1]));
      expect(sanitized.customerPains).toEqual([
        { text: "Supported pain", evidence: [1] },
      ]);
    },
  );
});
