import { describe, expect, it } from "vitest";
import {
  aftercareGuidance,
  compareDeploymentChoices,
  summariseOngoingCosts,
} from "../aftercarePlanning.js";

describe("customer aftercare transparency", () => {
  it("never invents provider prices", () => {
    const options = compareDeploymentChoices("react-node");
    expect(options.length).toBeGreaterThan(0);
    expect(options.every((option) => !option.priceKnown)).toBe(true);
    expect(options.every((option) => option.priceNotice.includes("no live price"))).toBe(true);
  });

  it("does not advertise deployment for structural-only Flutter apps", () => {
    expect(compareDeploymentChoices("flutter-node")).toEqual([]);
  });

  it("preserves unknown and variable monthly costs", () => {
    const result = summariseOngoingCosts([
      { service: "Hosting", provider: "Customer host", monthlyUsdCents: 1999, variable: false, billedTo: "customer", notes: "" },
      { service: "AI provider", provider: "Customer API", monthlyUsdCents: null, variable: true, billedTo: "customer", notes: "" },
    ]);
    expect(result.knownMonthlyUsdCents).toBe(1999);
    expect(result.hasUnknownCosts).toBe(true);
  });

  it("answers from project-specific state without claiming a live bill", () => {
    const answer = aftercareGuidance("What will it cost?", {
      name: "My booking app",
      stack: "react-node",
      status: "validated",
      costs: [],
    });
    expect(answer).toContain("My booking app");
    expect(answer).toContain("not live provider invoices");
  });
});
