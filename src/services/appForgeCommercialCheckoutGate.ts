import { assertCustomerComputeLaunchCertified } from "./customerComputeLaunchGate.js";
import { assertBuildExecutionReady } from "./buildExecutionReadiness.js";

/**
 * Before creating a paid Stripe session, verify that AppForge can actually
 * accept a customer build using a cost-reviewed provider and a working secure
 * build runtime. This replaces the unconditional production checkout stop.
 *
 * The checkout itself must independently verify exact approved USD Price IDs,
 * tax settings, customer identity, existing subscriptions and opt-in add-ons.
 */
export async function assertCommercialCheckoutReady(
  environment: string | undefined = process.env.NODE_ENV,
): Promise<void> {
  // Local tests and development use fake Stripe/payment providers. They must
  // not need production provider credentials or network connectivity.
  if (environment === "test" || environment === "development") return;

  if (environment !== "production") {
    throw new Error("Paid checkout requires the production Stripe environment");
  }

  assertCustomerComputeLaunchCertified(false, environment);
  await assertBuildExecutionReady();
}
