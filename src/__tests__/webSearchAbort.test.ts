import { afterEach, describe, expect, it, vi } from "vitest";
import { searchWeb } from "../services/webSearch.js";

const originalTavily = process.env.TAVILY_API_KEY;
const originalSerp = process.env.SERPAPI_API_KEY;
const originalSerpAlt = process.env.SERP_API_KEY;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalTavily === undefined) delete process.env.TAVILY_API_KEY;
  else process.env.TAVILY_API_KEY = originalTavily;
  if (originalSerp === undefined) delete process.env.SERPAPI_API_KEY;
  else process.env.SERPAPI_API_KEY = originalSerp;
  if (originalSerpAlt === undefined) delete process.env.SERP_API_KEY;
  else process.env.SERP_API_KEY = originalSerpAlt;
});

describe("web search cancellation", () => {
  it("rethrows an aborted provider request instead of falling through", async () => {
    process.env.TAVILY_API_KEY = "test-key";
    delete process.env.SERPAPI_API_KEY;
    delete process.env.SERP_API_KEY;

    const controller = new AbortController();
    controller.abort();
    const abort = new Error("aborted");
    abort.name = "AbortError";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(abort);

    await expect(
      searchWeb("cancel me", 6, controller.signal),
    ).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      signal: controller.signal,
    });
  });
});
