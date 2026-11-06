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
  type ProviderReservationInput,
} from "./providerSpendLedger.js";
import { assertCustomerComputeLaunchCertified } from "./customerComputeLaunchGate.js";


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
  invoke: () => Promise<T>,
): Promise<T> {
  // Standalone release stop: preparatory money controls do not authorize
  // real customer charges even if this helper is called outside the router.
  assertCustomerComputeLaunchCertified(false);
  const lease = currentBuildExecutionLease();
  if (!lease) throw new Error("Provider spending requires a build execution lease");
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
    throw new Error("Duplicate provider operation refused; inspect existing result");
  }
  await assertCurrentBuildLease();
  // Never automatically release the reservation on timeout, abort or error:
  // the provider might still have billed a request in transit.
  return invoke();
}
