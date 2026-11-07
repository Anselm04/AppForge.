import { describe, expect, it } from "vitest";
import { summarizeBuildProviderEvidence } from "../services/buildCostEvidence.js";
import type { StoredBuildEvent } from "../services/build-event-store.js";

const event = (
  id: number,
  payload: Record<string, unknown>,
): StoredBuildEvent => ({
  id,
  event: "provider_usage",
  payload,
});

describe("per-customer AI-provider cost evidence", () => {
  it("never represents unknown token prices as free provider usage", () => {
    const evidence = summarizeBuildProviderEvidence(
      [
        event(1, {
          userId: 7,
          executionId: 9,
          promptTokens: 100,
          completionTokens: 25,
          totalTokens: 125,
          succeeded: true,
          costUsdCents: null,
          costVerified: false,
        }),
        event(2, {
          userId: 7,
          executionId: 9,
          totalTokens: null,
          succeeded: false,
          costUsdCents: null,
          costVerified: false,
        }),
      ],
      7,
      9,
    );
    expect(evidence.observedRequests).toBe(2);
    expect(evidence.failedRequests).toBe(1);
    expect(evidence.observedTokens).toBe(125);
    expect(evidence.unknownCostSamples).toBe(2);
    expect(evidence.missingTokenSamples).toBe(1);
    expect(evidence.totalCostUsdCents).toBeNull();
    expect(evidence.providerInvoicesReconciled).toBe(false);
    expect(evidence.spendingLimitEnforced).toBe(false);
  });

  it("only summarises a requested customer's build and deduplicates event ids", () => {
    const records = [
      event(1, {
        userId: 7,
        executionId: 1,
        succeeded: true,
        totalTokens: 10,
        costVerified: true,
        costUsdCents: 12,
      }),
      event(1, {
        userId: 7,
        executionId: 1,
        succeeded: true,
        totalTokens: 10,
        costVerified: true,
        costUsdCents: 12,
      }),
      event(2, {
        userId: 8,
        executionId: 1,
        succeeded: true,
        totalTokens: 10000,
        costVerified: true,
        costUsdCents: 50000,
      }),
      event(3, {
        userId: 7,
        executionId: 2,
        succeeded: true,
        totalTokens: 200,
        costVerified: true,
        costUsdCents: 35,
      }),
      { id: 4, event: "build_claim", payload: { userId: 7 } },
    ];
    const evidence = summarizeBuildProviderEvidence(records, 7, 1);
    expect(evidence.observedRequests).toBe(1);
    expect(evidence.verifiedCostSubtotalUsdCents).toBe(12);
    expect(evidence.totalCostUsdCents).toBe(12);
    expect(evidence.observedTokens).toBe(10);
    expect(evidence.costFullyVerified).toBe(true);
  });

  it("rejects invalid costs and integer overflows rather than underreporting", () => {
    const x = summarizeBuildProviderEvidence(
      [
        event(1, {
          userId: 1,
          succeeded: true,
          totalTokens: -1,
          costUsdCents: -50,
          costVerified: true,
        }),
        event(2, {
          userId: 1,
          succeeded: true,
          totalTokens: 1.5,
          costUsdCents: Number.POSITIVE_INFINITY,
          costVerified: true,
        }),
      ],
      1,
    );
    expect(x.unknownCostSamples).toBe(2);
    expect(x.missingTokenSamples).toBe(2);
    expect(x.totalCostUsdCents).toBeNull();
    expect(() => summarizeBuildProviderEvidence([], 0)).toThrow();
  });

  it("a build with no provider events is not certified zero-cost", () => {
    const x = summarizeBuildProviderEvidence([], 1);
    expect(x.totalCostUsdCents).toBeNull();
    expect(x.costFullyVerified).toBe(false);
  });
});
