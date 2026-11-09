import type { LlmProvider } from "./llmProviders.js";
import type { TrustedRate } from "./providerCostEnvelope.js";

/**
 * Pick only providers for which AppForge holds a currently reviewed monetary
 * rate for the actual model about to run. This avoids admitting a build on one
 * valid provider then accidentally selecting an unpriced provider first.
 */
export function selectRatedLlmProviders(
  providers: readonly LlmProvider[],
  rates: readonly TrustedRate[],
  explicitModel = "",
  now: Date = new Date(),
): LlmProvider[] {
  const current = now.getTime();
  if (!Number.isFinite(current)) return [];
  return providers.filter((provider) => {
    const model = explicitModel.trim() || provider.defaultModel;
    return rates.some(
      (rate) =>
        rate.provider === provider.id &&
        rate.model === model &&
        rate.sourceUrl?.startsWith("https://") &&
        Number.isFinite(Date.parse(rate.reviewedAt)) &&
        Date.parse(rate.reviewedAt) <= current &&
        Number.isFinite(Date.parse(rate.validUntil)) &&
        Date.parse(rate.validUntil) > current &&
        Number.isSafeInteger(rate.inputUsdMicrosPerMillionTokens) &&
        rate.inputUsdMicrosPerMillionTokens >= 0 &&
        Number.isSafeInteger(rate.outputUsdMicrosPerMillionTokens) &&
        rate.outputUsdMicrosPerMillionTokens >= 0 &&
        Number.isSafeInteger(rate.fixedRequestCents) &&
        rate.fixedRequestCents >= 0 &&
        (rate.inputUsdMicrosPerMillionTokens > 0 ||
          rate.outputUsdMicrosPerMillionTokens > 0 ||
          rate.fixedRequestCents > 0),
    );
  });
}
