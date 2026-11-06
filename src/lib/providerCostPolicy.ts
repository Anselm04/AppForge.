/**
 * Conservative USD-cent budget calculations for offline pricing qualification.
 * This is NOT a provider-charge ledger or an authorisation to start production.
 * Provider invoice reconciliation + atomic DB reservations are still required.
 */
export const PROVISIONAL_PROVIDER_MONTHLY_CEILINGS_CENTS = {
  free: 0,
  starter: 1200,
  builder: 3500,
  studio: 9500,
} as const;

type QuoteInput = {
  worstCaseProviderCents: number;
  supportAndLabourCents: number;
  allocatedOverheadCents: number;
  paymentFeeBasisPoints: number;
  targetContributionMarginBasisPoints: number;
};

function safeCents(n: number): boolean {
  return Number.isSafeInteger(n) && n >= 0;
}

export function minimumPriceForMargin(input: QuoteInput): number {
  const costs = [
    input.worstCaseProviderCents,
    input.supportAndLabourCents,
    input.allocatedOverheadCents,
  ];
  if (
    costs.some((v) => !safeCents(v)) ||
    !safeCents(input.paymentFeeBasisPoints) ||
    !safeCents(input.targetContributionMarginBasisPoints) ||
    input.paymentFeeBasisPoints +
      input.targetContributionMarginBasisPoints >= 10000
  ) {
    throw new Error("Invalid unit economics; refuse this quote");
  }
  const direct = costs.reduce((sum, n) => sum + n, 0);
  if (!Number.isSafeInteger(direct)) {
    throw new Error("Unit economics exceed safe monetary precision");
  }
  const divisor =
    10000 -
    input.paymentFeeBasisPoints -
    input.targetContributionMarginBasisPoints;
  const required = Math.ceil((direct * 10000) / divisor);
  if (!safeCents(required)) {
    throw new Error("Quoted price exceeds safe monetary precision");
  }
  return required;
}

export function evaluateProvisionalProviderBudget(input: {
  tier: keyof typeof PROVISIONAL_PROVIDER_MONTHLY_CEILINGS_CENTS;
  usedCents: number;
  pendingCents: number;
  estimatedWorstCaseNewCents: number;
}): { permittedByModel: boolean; availableCents: number; reason: string } {
  const { tier, usedCents, pendingCents, estimatedWorstCaseNewCents } = input;
  if (
    !safeCents(usedCents) ||
    !safeCents(pendingCents) ||
    !safeCents(estimatedWorstCaseNewCents)
  ) {
    throw new Error("Unknown or invalid customer provider costs");
  }
  if (!Object.prototype.hasOwnProperty.call(PROVISIONAL_PROVIDER_MONTHLY_CEILINGS_CENTS, tier)) {
    throw new Error("Unknown customer tier; refuse provisional budget");
  }
  const cap = PROVISIONAL_PROVIDER_MONTHLY_CEILINGS_CENTS[tier];
  const used = usedCents + pendingCents;
  if (!Number.isSafeInteger(used)) {
    throw new Error("Provider cost accounting overflow");
  }
  const availableCents = Math.max(0, cap - used);
  return {
    permittedByModel: estimatedWorstCaseNewCents <= availableCents &&
      estimatedWorstCaseNewCents > 0,
    availableCents,
    reason:
      estimatedWorstCaseNewCents <= availableCents &&
      estimatedWorstCaseNewCents > 0
        ? "Within provisional model only; no live authorisation"
        : "Provisional provider-cost budget insufficient; pause and quote",
  };
}
