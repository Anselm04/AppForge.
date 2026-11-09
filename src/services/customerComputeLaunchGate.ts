import { TRPCError } from "@trpc/server";
import { listConfiguredLlmProviders } from "../lib/llmProviders.js";
import { trustedRates } from "../lib/providerCostEnvelope.js";

/**
 * Customer builds are admitted based on real, currently configured service
 * capabilities — not a permanent NODE_ENV-based production embargo.
 *
 * All billable AI attempts still require an execution lease and an atomic
 * customer spend reservation at the network boundary. Separate build-runtime
 * readiness, paid entitlements, credit availability and provider limits are
 * checked at their own operations.
 */
export const CUSTOMER_COMPUTE_NOT_CERTIFIED =
  "An AI provider with a valid reviewed price and spending ceiling is needed for this build. Configure a supported provider; no billable request was sent.";

export function customerComputeLaunchCertified(
  environment: string | undefined = process.env.NODE_ENV,
): boolean {
  if (environment === "test" || environment === "development") return true;
  if (environment !== "production") return false;

  const maximum = Number(process.env.APPFORGE_LLM_RUNTIME_MAX_CENTS);
  if (!Number.isSafeInteger(maximum) || maximum < 1) return false;

  try {
    const now = Date.now();
    const providers = listConfiguredLlmProviders();
    const rates = trustedRates();
    return providers.some((provider) =>
      rates.some(
        (rate) =>
          rate.provider === provider.id &&
          rate.model === provider.defaultModel &&
          Number.isSafeInteger(rate.inputUsdMicrosPerMillionTokens) &&
          rate.inputUsdMicrosPerMillionTokens >= 0 &&
          Number.isSafeInteger(rate.outputUsdMicrosPerMillionTokens) &&
          rate.outputUsdMicrosPerMillionTokens >= 0 &&
          Number.isSafeInteger(rate.fixedRequestCents) &&
          rate.fixedRequestCents >= 0 &&
          (rate.inputUsdMicrosPerMillionTokens > 0 ||
            rate.outputUsdMicrosPerMillionTokens > 0 ||
            rate.fixedRequestCents > 0) &&
          rate.sourceUrl?.startsWith("https://") &&
          Number.isFinite(Date.parse(rate.reviewedAt)) &&
          Date.parse(rate.reviewedAt) <= now &&
          Number.isFinite(Date.parse(rate.validUntil)) &&
          Date.parse(rate.validUntil) > now,
      ),
    );
  } catch {
    return false;
  }
}

export function assertCustomerComputeLaunchCertified(
  _owner: boolean,
  environment: string | undefined = process.env.NODE_ENV,
): void {
  if (customerComputeLaunchCertified(environment)) return;
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: CUSTOMER_COMPUTE_NOT_CERTIFIED,
  });
}
