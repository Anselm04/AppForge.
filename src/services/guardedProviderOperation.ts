import {
  assertProviderPricesConfirmed,
  maximumProviderEnvelopeCents,
  type CostEnvelope,
} from "../lib/providerCostEnvelope.js";
import {
  currentBuildExecutionLease,
  assertCurrentBuildLease,
} from "./buildExecutionLease.js";
import {
  reserveProviderSpend,
  releaseProviderSpend,
  settleProviderSpend,
  type ProviderReservationInput,
} from "./providerSpendLedger.js";

class ReservationReleaseError extends Error {
  constructor(
    readonly leaseError: unknown,
    readonly releaseError: unknown,
  ) {
    super(
      "Build lease was lost before dispatch and reservation release failed",
    );
    this.name = "ReservationReleaseError";
  }
}

/**
 * Preparatory paid-operation guard. This does not authorize production work.
 * Pricing input must be independently sourced, and every billable attempt
 * (including transport retries and fallbacks) must be enumerated in envelope.
 */
export async function runReservedProviderOperation<T>(
  options: {
    operationId: ProviderReservationInput["operationId"];
    envelope: CostEnvelope;
  },
  invoke: () => Promise<{ value: T; verifiedCents: number | null }>,
): Promise<T> {
  // No independent blanket stop: every operation must prove an active lease,
  // independently reviewed rates and an atomic spending reservation.
  const lease = currentBuildExecutionLease();
  if (!lease)
    throw new Error("Provider spending requires a build execution lease");
  await assertCurrentBuildLease();
  assertProviderPricesConfirmed(options.envelope);
  const maximumCents = maximumProviderEnvelopeCents(options.envelope);
  const status = await reserveProviderSpend({
    operationId: options.operationId,
    userId: lease.userId,
    projectId: lease.projectId,
    executionId: lease.executionId,
    maximumCents,
  });
  // Replaying the same request must not dispatch a second billable operation.
  if (status !== "reserved") {
    throw new Error(
      "Duplicate provider operation refused; inspect existing result",
    );
  }
  try {
    await assertCurrentBuildLease();
  } catch (leaseError) {
    try {
      await releaseProviderSpend(lease.userId, options.operationId);
    } catch (releaseError) {
      throw new ReservationReleaseError(leaseError, releaseError);
    }
    throw leaseError;
  }
  // An error or uncertain charge must leave the reservation in place.
  const result = await invoke();
  // An HTTP failure or uncertain charge must retain its reservation; each
  // subsequent retry has its own separately reserved operation ID.
  if (result.verifiedCents !== null) {
    await settleProviderSpend(
      lease.userId,
      options.operationId,
      result.verifiedCents,
    );
  }
  return result.value;
}
