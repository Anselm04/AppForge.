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
    envelope.attempts = [{
      ...envelope.attempts[0],
      maxInputTokens: 1,
      maxOutputTokens: 1,
      fixedRequestCents: 0,
    }];
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
    assumedFree.attempts = [{
      ...assumedFree.attempts[0],
      inputUsdMicrosPerMillionTokens: 0,
      outputUsdMicrosPerMillionTokens: 0,
      fixedRequestCents: 0,
    }];
    expect(() => maximumProviderEnvelopeCents(assumedFree, clock)).toThrow();
  });

  it("does not treat provisional rates as certified live provider prices", () => {
    const quote = sample();
    expect(() => assertProviderPricesConfirmed(quote, clock)).toThrow(/provisional/);
    quote.priceSnapshotSource = "provider_confirmed";
    expect(() => assertProviderPricesConfirmed(quote, clock)).not.toThrow();
    expect(() => assertProviderPricesConfirmed(quote, new Date("2026-11-08T00:00:00Z"))).toThrow(/expired/);
  });
});
