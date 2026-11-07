import { describe, expect, it } from "vitest";
import {
  assertProviderPricesConfirmed,
  maximumProviderEnvelopeCents,
  type CostEnvelope,
} from "../lib/providerCostEnvelope.js";

const clock = new Date("2026-11-06T00:00:00.000Z");
const sample = (): CostEnvelope => ({
  attempts: [
    {
      provider: "mock-llm",
      model: "mock-small",
      maxInputTokens: 1000000,
      maxOutputTokens: 1000000,
      inputUsdMicrosPerMillionTokens: 250000,
      outputUsdMicrosPerMillionTokens: 1000000,
      fixedRequestCents: 10,
    },
  ],
  externalRuntimeStorageEgressCents: 40,
  priceSnapshotValidUntil: "2026-11-07T00:00:00.000Z",
  priceSnapshotSource: "provisional",
});

describe("conservative provider-cost envelope (offline only)", () => {
  it("reserves input, output, fixed and external resource ceilings", () => {
    // One million tokens at $0.25 + $1.00, $0.10 request, $0.40 runtime.
    expect(maximumProviderEnvelopeCents(sample(), clock)).toBe(175);
  });

  it("counts failed retries and fallback requests at their full worst case", () => {
    const envelope = sample();
    envelope.attempts = [...envelope.attempts, ...envelope.attempts];
    expect(maximumProviderEnvelopeCents(envelope, clock)).toBe(310);
  });

  it("rounds fractional USD cents up, never down", () => {
    const envelope = sample();
    envelope.externalRuntimeStorageEgressCents = 0;
    envelope.attempts = [
      {
        ...envelope.attempts[0],
        maxInputTokens: 1,
        maxOutputTokens: 1,
        fixedRequestCents: 0,
      },
    ];
    expect(maximumProviderEnvelopeCents(envelope, clock)).toBe(1);
  });

  it("rejects missing price evidence, expired rates and unknown costs", () => {
    const noAttempts = sample();
    noAttempts.attempts = [];
    expect(() => maximumProviderEnvelopeCents(noAttempts, clock)).toThrow();

    const badCost = sample();
    badCost.externalRuntimeStorageEgressCents = Number.NaN;
    expect(() => maximumProviderEnvelopeCents(badCost, clock)).toThrow();

    const badRate = sample();
    badRate.attempts = [{ ...badRate.attempts[0], maxOutputTokens: -1 }];
    expect(() => maximumProviderEnvelopeCents(badRate, clock)).toThrow();

    const expired = sample();
    expired.priceSnapshotValidUntil = "2026-11-05T00:00:00.000Z";
    expect(() => maximumProviderEnvelopeCents(expired, clock)).toThrow();

    const assumedFree = sample();
    assumedFree.attempts = [
      {
        ...assumedFree.attempts[0],
        inputUsdMicrosPerMillionTokens: 0,
        outputUsdMicrosPerMillionTokens: 0,
        fixedRequestCents: 0,
      },
    ];
    expect(() => maximumProviderEnvelopeCents(assumedFree, clock)).toThrow();
  });

  it("requires protected reviewed prices, rejecting fake or expired evidence", () => {
    const prior = process.env.APPFORGE_PROVIDER_PRICE_CATALOG_JSON;
    const quote = sample();
    const rate = {
      provider: "mock-llm",
      model: "mock-small",
      inputUsdMicrosPerMillionTokens: 250000,
      outputUsdMicrosPerMillionTokens: 1000000,
      fixedRequestCents: 10,
      sourceUrl: "https://provider.example/pricing",
      reviewedAt: "2026-11-05T00:00:00.000Z",
      validUntil: "2026-11-07T00:00:00.000Z",
    };
    try {
      delete process.env.APPFORGE_PROVIDER_PRICE_CATALOG_JSON;
      expect(() => assertProviderPricesConfirmed(quote, clock)).toThrow();
      quote.priceSnapshotSource = "provider_confirmed";
      expect(() => assertProviderPricesConfirmed(quote, clock)).toThrow(
        /not configured/,
      );
      process.env.APPFORGE_PROVIDER_PRICE_CATALOG_JSON = JSON.stringify([rate]);
      expect(() => assertProviderPricesConfirmed(quote, clock)).not.toThrow();
      quote.attempts = [
        { ...quote.attempts[0], outputUsdMicrosPerMillionTokens: 900000 },
      ];
      expect(() => assertProviderPricesConfirmed(quote, clock)).toThrow(
        /understates/,
      );
      quote.attempts = sample().attempts;
      process.env.APPFORGE_PROVIDER_PRICE_CATALOG_JSON = JSON.stringify([
        rate,
        rate,
      ]);
      expect(() => assertProviderPricesConfirmed(quote, clock)).toThrow(
        /Duplicate/,
      );
      process.env.APPFORGE_PROVIDER_PRICE_CATALOG_JSON = JSON.stringify([rate]);
      expect(() =>
        assertProviderPricesConfirmed(quote, new Date("2026-11-08T00:00:00Z")),
      ).toThrow(/expired/i);
    } finally {
      if (prior === undefined) {
        delete process.env.APPFORGE_PROVIDER_PRICE_CATALOG_JSON;
      } else {
        process.env.APPFORGE_PROVIDER_PRICE_CATALOG_JSON = prior;
      }
    }
  });
});
