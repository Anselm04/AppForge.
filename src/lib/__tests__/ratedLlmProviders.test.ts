import { describe, expect, it } from "vitest";
import { selectRatedLlmProviders } from "../ratedLlmProviders.js";
import type { LlmProvider } from "../llmProviders.js";
import type { TrustedRate } from "../providerCostEnvelope.js";

const provider = (id: LlmProvider["id"], model: string): LlmProvider => ({
  id,
  defaultModel: model,
  baseUrl: "https://example.com/v1",
  apiKey: "test-only",
});

const rate = (id: string, model: string, expires = "2099-01-01T00:00:00Z"): TrustedRate => ({
  provider: id,
  model,
  inputUsdMicrosPerMillionTokens: 1000000,
  outputUsdMicrosPerMillionTokens: 1000000,
  fixedRequestCents: 1,
  reviewedAt: "2026-11-01T00:00:00Z",
  validUntil: expires,
  sourceUrl: "https://example.com/pricing",
});

// prettier-ignore
describe("rated customer provider selection", () => {
  it("skips unpriced providers rather than failing after the build begins", () => {
    const choices = [
      provider("groq", "unreviewed"),
      provider("gemini", "approved"),
    ];
    expect(
      selectRatedLlmProviders(choices, [rate("gemini", "approved")]).map((p) => p.id),
    ).toEqual(["gemini"]);
  });

  it("never substitutes a price for a different requested model", () => {
    expect(
      selectRatedLlmProviders(
        [provider("gemini", "cheap")],
        [rate("gemini", "cheap")],
        "premium",
      ),
    ).toEqual([]);
  });

  it("rejects expired and invalid zero-priced provider evidence", () => {
    const expired = rate("groq", "model", "2025-01-01T00:00:00Z");
    expect(selectRatedLlmProviders([provider("groq", "model")], [expired])).toEqual([]);
    expect(
      selectRatedLlmProviders(
        [provider("groq", "model")],
        [{ ...rate("groq", "model"), fixedRequestCents: 0, inputUsdMicrosPerMillionTokens: 0, outputUsdMicrosPerMillionTokens: 0 }],
      ),
    ).toEqual([]);
  });
});
