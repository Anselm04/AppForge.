import { afterEach, describe, expect, it, vi } from "vitest";
import { searchWeb } from "../services/webSearch.js";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("customer research pricing and no-surprise spend", () => {
  it("uses free public research when paid providers have no customer spending lease", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TAVILY_API_KEY", "test-key-never-sent");
    vi.stubEnv("SERPAPI_API_KEY", "test-key-never-sent");
    const outbound = vi.fn(async () =>
      new Response(
        JSON.stringify({
          AbstractText: "Public summary",
          AbstractURL: "https://example.org/research",
          Heading: "Public source",
          Results: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", outbound);
    const results = await searchWeb("ordinary business software", 3);
    expect(results.results.length).toBe(1);
    expect(results.results[0].source).toBe("duckduckgo");
    expect(outbound).toHaveBeenCalledOnce();
    expect(String(outbound.mock.calls[0][0])).toContain("duckduckgo.com");
    expect(results.providerAttempts?.some(
      (item) => item.provider === "tavily" && item.detail === "scoped_customer_budget_required",
    )).toBe(true);
  });
});
