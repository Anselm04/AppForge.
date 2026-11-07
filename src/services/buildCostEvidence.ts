import type { StoredBuildEvent } from "./build-event-store.js";

type UsagePayload = {
  userId?: unknown;
  executionId?: unknown;
  promptTokens?: unknown;
  completionTokens?: unknown;
  totalTokens?: unknown;
  succeeded?: unknown;
  costVerified?: unknown;
  costUsdCents?: unknown;
};

const safeCount = (value: unknown): number | null =>
  Number.isSafeInteger(value) && (value as number) >= 0
    ? (value as number)
    : null;

/**
 * Conservative evidence summary, NOT a monetary spend-control ledger.
 * A 0 verified-cost subtotal is never represented as a zero total cost when
 * any provider request has unverified or missing pricing evidence.
 */
export function summarizeBuildProviderEvidence(
  events: readonly StoredBuildEvent[],
  userId: number,
  executionId?: number,
) {
  if (!Number.isSafeInteger(userId) || userId < 1) {
    throw new Error("A valid build owner is required");
  }
  if (
    executionId !== undefined &&
    (!Number.isSafeInteger(executionId) || executionId < 1)
  ) {
    throw new Error("A valid build execution is required");
  }

  let observedRequests = 0;
  let failedRequests = 0;
  let missingTokenSamples = 0;
  let unknownCostSamples = 0;
  let verifiedCostSubtotalUsdCents = 0;
  let observedTokens = 0;
  const seen = new Set<number>();

  for (const event of events) {
    if (event.event !== "provider_usage") continue;
    if (!Number.isSafeInteger(event.id) || seen.has(event.id)) continue;
    const sample = event.payload as UsagePayload | null;
    if (!sample || typeof sample !== "object") continue;
    if (sample.userId !== userId) continue;
    if (executionId !== undefined && sample.executionId !== executionId) {
      continue;
    }
    seen.add(event.id);
    observedRequests++;
    if (sample.succeeded !== true) failedRequests++;
    const total = safeCount(sample.totalTokens);
    if (total === null || !Number.isSafeInteger(observedTokens + total)) {
      missingTokenSamples++;
    } else {
      observedTokens += total;
    }

    const amount = safeCount(sample.costUsdCents);
    if (
      sample.costVerified === true &&
      amount !== null &&
      Number.isSafeInteger(verifiedCostSubtotalUsdCents + amount)
    ) {
      verifiedCostSubtotalUsdCents += amount;
    } else {
      unknownCostSamples++;
    }
  }

  return {
    observedRequests,
    failedRequests,
    missingTokenSamples,
    unknownCostSamples,
    observedTokens,
    verifiedCostSubtotalUsdCents,
    // Null explicitly indicates no reliable all-inclusive spend total.
    totalCostUsdCents:
      observedRequests > 0 && unknownCostSamples === 0
        ? verifiedCostSubtotalUsdCents
        : null,
    costFullyVerified: observedRequests > 0 && unknownCostSamples === 0,
    source: "build_events" as const,
    providerInvoicesReconciled: false,
    spendingLimitEnforced: false,
  };
}
