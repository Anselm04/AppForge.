import { afterEach, describe, expect, it, vi } from "vitest";
import { searchWeb } from "../services/webSearch.js";

const originalTavily = process.env.TAVILY_API_KEY;
const originalSerp = process.env.SERPAPI_API_KEY;
const originalSerpAlt = process.env.SERP_API_KEY;
const originalGemini = process.env.GEMINI_API_KEY;
const originalGrounding = process.env.GEMINI_SEARCH_GROUNDING;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalTavily === undefined) delete process.env.TAVILY_API_KEY;
  else process.env.TAVILY_API_KEY = originalTavily;
  if (originalSerp === undefined) delete process.env.SERPAPI_API_KEY;
  else process.env.SERPAPI_API_KEY = originalSerp;
  if (originalSerpAlt === undefined) delete process.env.SERP_API_KEY;
  else process.env.SERP_API_KEY = originalSerpAlt;
  if (originalGemini === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalGemini;
  if (originalGrounding === undefined)
    delete process.env.GEMINI_SEARCH_GROUNDING;
  else process.env.GEMINI_SEARCH_GROUNDING = originalGrounding;
});

describe("web search cancellation", () => {
  it("rethrows when the caller signal is already aborted before any provider call", async () => {
    process.env.TAVILY_API_KEY = "test-key";
    delete process.env.SERPAPI_API_KEY;
    delete process.env.SERP_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_SEARCH_GROUNDING;

    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(
      searchWeb("cancel me", 6, controller.signal),
    ).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rethrows an abort that happens during a provider request instead of falling through", async () => {
    process.env.TAVILY_API_KEY = "test-key";
    delete process.env.SERPAPI_API_KEY;
    delete process.env.SERP_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_SEARCH_GROUNDING;

    const controller = new AbortController();
    const abort = new Error("aborted");
    abort.name = "AbortError";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      controller.abort();
      return Promise.reject(abort);
    });

    await expect(
      searchWeb("cancel me", 6, controller.signal),
    ).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
