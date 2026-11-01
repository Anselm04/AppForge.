import { describe, expect, it } from "vitest";
import {
  buildOpportunityBuildPath,
  promptFromOpportunityQuery,
} from "../lib/marketIntelligenceHandoff.js";

describe("market intelligence build handoff", () => {
  it("encodes a build brief into the existing app creation route", () => {
    const path = buildOpportunityBuildPath("Build a booking app with push alerts");
    expect(path).toBe(
      "/app/new?idea=Build%20a%20booking%20app%20with%20push%20alerts",
    );
  });

  it("prefers an explicit opportunity brief over a saved draft and caps it", () => {
    const longIdea = "x".repeat(20_000);
    expect(promptFromOpportunityQuery(`?idea=${longIdea}`, "saved draft")).toHaveLength(
      10_000,
    );
    expect(promptFromOpportunityQuery("", "saved draft")).toBe("saved draft");
  });
});
