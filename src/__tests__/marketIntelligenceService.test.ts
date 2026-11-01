import { describe, expect, it } from "vitest";
import {
  buildMarketResearchQueries,
  dedupeMarketSources,
  parseMarketAnalysis,
} from "../services/marketIntelligence.js";

describe("market intelligence research service", () => {
  it("builds a bounded query set that covers demand, competitors, reviews, and marketing", () => {
    const queries = buildMarketResearchQueries({
      idea: "reservation alert app",
      audience: "busy diners",
      region: "New Zealand",
    });

    expect(queries).toHaveLength(4);
    expect(queries.join(" ")).toContain("reservation alert app");
    expect(queries.join(" ")).toContain("competitor");
    expect(queries.join(" ")).toContain("reviews");
    expect(queries.join(" ")).toContain("marketing");
  });

  it("deduplicates repeated evidence URLs and assigns stable source ids", () => {
    const sources = dedupeMarketSources([
      {
        title: "One",
        url: "https://example.com/a",
        snippet: "a",
        source: "duckduckgo",
      },
      {
        title: "Duplicate",
        url: "https://example.com/a",
        snippet: "duplicate",
        source: "serpapi",
      },
      {
        title: "Two",
        url: "https://example.com/b",
        snippet: "b",
        source: "tavily",
      },
    ]);

    expect(sources.map((source) => source.id)).toEqual([1, 2]);
    expect(sources.map((source) => source.url)).toEqual([
      "https://example.com/a",
      "https://example.com/b",
    ]);
  });

  it("rejects analysis JSON that is not structurally valid", () => {
    expect(() => parseMarketAnalysis('{"summary":"not an evidence item"}')).toThrow(
      /valid market intelligence/i,
    );
  });
});
