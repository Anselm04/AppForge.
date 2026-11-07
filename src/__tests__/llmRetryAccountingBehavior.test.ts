import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithBackoff } from "../_core/llm.js";

describe("provider retry accounting cannot silently fail", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("does not send a second provider request if a 429 retry cannot be accounted", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "rate limited" }), {
        status: 429,
        headers: { "retry-after": "0", "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const evidence = vi.fn().mockRejectedValue(new Error("Database unavailable"));
    await expect(
      fetchWithBackoff("https://provider.example/v1/chat", { method: "POST" }, evidence),
    ).rejects.toThrow("Provider retry was stopped because usage accounting failed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(evidence).toHaveBeenCalledTimes(1);
  });

  it("does not send a second provider request if an uncertain network error cannot be accounted", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("Connection lost"));
    vi.stubGlobal("fetch", fetchMock);
    const evidence = vi.fn().mockRejectedValue(new Error("Ledger unavailable"));
    await expect(
      fetchWithBackoff("https://provider.example/v1/chat", { method: "POST" }, evidence),
    ).rejects.toThrow("Provider retry was stopped because usage accounting failed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(evidence).toHaveBeenCalledTimes(1);
  });
});
