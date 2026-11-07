/**
 * Offline, conservative provider spend-envelope arithmetic. Never opens a
 * customer release gate. Real operations require a provider-confirmed rate
 * snapshot, authenticated limits, a persistent reservation and reconciliation.
 */
export type CostedProviderAttempt = {
  provider: string;
  model: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  inputUsdMicrosPerMillionTokens: number;
  outputUsdMicrosPerMillionTokens: number;
  fixedRequestCents: number;
};

export type CostEnvelope = {
  attempts: readonly CostedProviderAttempt[];
  externalRuntimeStorageEgressCents: number;
  priceSnapshotValidUntil: string;
  priceSnapshotSource: "provisional" | "provider_confirmed";
};

const nonnegative = (n: number): boolean => Number.isSafeInteger(n) && n >= 0;

const positive = (n: number): boolean => Number.isSafeInteger(n) && n > 0;

function toCentsFromMicrosOfUsd(value: bigint): bigint {
  // 1 US cent = 10,000 USD micro-units.
  return (value + 9999n) / 10000n;
}

function perAttemptMaximumCents(attempt: CostedProviderAttempt): bigint {
  if (
    !attempt.provider.trim() ||
    !attempt.model.trim() ||
    !positive(attempt.maxInputTokens) ||
    !positive(attempt.maxOutputTokens) ||
    !nonnegative(attempt.inputUsdMicrosPerMillionTokens) ||
    !nonnegative(attempt.outputUsdMicrosPerMillionTokens) ||
    !nonnegative(attempt.fixedRequestCents)
  ) {
    throw new Error("Provider rate or maximum token budget is unknown");
  }
  if (
    attempt.inputUsdMicrosPerMillionTokens === 0 &&
    attempt.outputUsdMicrosPerMillionTokens === 0 &&
    attempt.fixedRequestCents === 0
  ) {
    // Explicit zero-rated providers still require separate proof, not a
    // silently assumed zero-price network operation.
    throw new Error("Zero-cost provider rate cannot be assumed");
  }
  const inputMicros =
    (BigInt(attempt.maxInputTokens) *
      BigInt(attempt.inputUsdMicrosPerMillionTokens) +
      999999n) /
    1000000n;
  const outputMicros =
    (BigInt(attempt.maxOutputTokens) *
      BigInt(attempt.outputUsdMicrosPerMillionTokens) +
      999999n) /
    1000000n;
  return (
    toCentsFromMicrosOfUsd(inputMicros + outputMicros) +
    BigInt(attempt.fixedRequestCents)
  );
}

/**
 * A complete list of permitted attempts (including each retry and fallback)
 * is charged at its worst case. The caller must not add an unquoted attempt.
 * Unknown infrastructure costs cause rejection instead of being counted $0.
 */
export function maximumProviderEnvelopeCents(
  envelope: CostEnvelope,
  now: Date = new Date(),
): number {
  if (
    !Array.isArray(envelope.attempts) ||
    envelope.attempts.length === 0 ||
    envelope.attempts.length > 64 ||
    !nonnegative(envelope.externalRuntimeStorageEgressCents) ||
    !Number.isFinite(now.getTime()) ||
    !Number.isFinite(Date.parse(envelope.priceSnapshotValidUntil)) ||
    Date.parse(envelope.priceSnapshotValidUntil) <= now.getTime() ||
    !["provisional", "provider_confirmed"].includes(
      envelope.priceSnapshotSource,
    )
  ) {
    throw new Error("Incomplete or expired provider cost envelope");
  }

  let maximum = BigInt(envelope.externalRuntimeStorageEgressCents);
  for (const attempt of envelope.attempts) {
    maximum += perAttemptMaximumCents(attempt);
  }
  if (maximum > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Provider cost envelope exceeds safe monetary range");
  }
  return Number(maximum);
}

/**
 * Protected server-only provider price catalogue. Entries are reviewed
 * independently of the generated project; callers cannot supply the trust
 * record in their request. Rate changes/expiry require operator review.
 */
type TrustedRate = {
  provider: string;
  model: string;
  inputUsdMicrosPerMillionTokens: number;
  outputUsdMicrosPerMillionTokens: number;
  fixedRequestCents: number;
  reviewedAt: string;
  validUntil: string;
  sourceUrl: string;
};

function trustedRates(): TrustedRate[] {
  const raw = process.env.APPFORGE_PROVIDER_PRICE_CATALOG_JSON;
  if (!raw)
    throw new Error("Trusted provider price catalogue is not configured");
  let catalog: unknown;
  try {
    catalog = JSON.parse(raw);
  } catch {
    throw new Error("Invalid trusted provider price catalogue JSON");
  }
  if (!Array.isArray(catalog) || catalog.length === 0 || catalog.length > 128) {
    throw new Error(
      "Trusted provider price catalogue must contain reviewed rates",
    );
  }
  return catalog as TrustedRate[];
}

/**
 * Reject unreviewed, understated, ambiguous and expired provider prices.
 * This verifies cost ceilings; a separate active execution lease and atomic
 * customer reservation are still mandatory before any billable dispatch.
 */
export function assertProviderPricesConfirmed(
  envelope: CostEnvelope,
  now: Date = new Date(),
): void {
  maximumProviderEnvelopeCents(envelope, now);
  if (envelope.priceSnapshotSource !== "provider_confirmed") {
    throw new Error("Provider cost quote uses provisional pricing");
  }
  const catalog = new Map<string, TrustedRate>();
  for (const rate of trustedRates()) {
    if (
      !rate ||
      typeof rate.provider !== "string" ||
      typeof rate.model !== "string" ||
      !rate.provider.trim() ||
      !rate.model.trim() ||
      !nonnegative(rate.inputUsdMicrosPerMillionTokens) ||
      !nonnegative(rate.outputUsdMicrosPerMillionTokens) ||
      !nonnegative(rate.fixedRequestCents) ||
      (rate.inputUsdMicrosPerMillionTokens === 0 &&
        rate.outputUsdMicrosPerMillionTokens === 0 &&
        rate.fixedRequestCents === 0) ||
      typeof rate.sourceUrl !== "string" ||
      !/^https:\/\//.test(rate.sourceUrl) ||
      !Number.isFinite(Date.parse(rate.reviewedAt)) ||
      !Number.isFinite(Date.parse(rate.validUntil)) ||
      Date.parse(rate.reviewedAt) > now.getTime() ||
      Date.parse(rate.validUntil) <= now.getTime() ||
      Date.parse(rate.reviewedAt) >= Date.parse(rate.validUntil)
    ) {
      throw new Error("Trusted provider price entry is invalid or expired");
    }
    const key = JSON.stringify([rate.provider, rate.model]);
    if (catalog.has(key)) throw new Error("Duplicate reviewed provider price");
    catalog.set(key, rate);
  }
  for (const attempt of envelope.attempts) {
    const rate = catalog.get(JSON.stringify([attempt.provider, attempt.model]));
    if (!rate) throw new Error("Provider/model has no trusted price");
    if (
      attempt.inputUsdMicrosPerMillionTokens <
        rate.inputUsdMicrosPerMillionTokens ||
      attempt.outputUsdMicrosPerMillionTokens <
        rate.outputUsdMicrosPerMillionTokens ||
      attempt.fixedRequestCents < rate.fixedRequestCents ||
      Date.parse(envelope.priceSnapshotValidUntil) >
        Date.parse(rate.validUntil)
    ) {
      throw new Error("Provider cost envelope understates reviewed pricing");
    }
  }
}
