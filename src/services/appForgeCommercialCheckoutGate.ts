/**
 * The owner approved the USD subscription and provider-credit pack terms, but
 * production Stripe Price IDs, refund reconciliation, and end-to-end release
 * qualification are not complete. Therefore no new production checkout
 * session is issued.
 *
 * This is intentionally NOT a boolean env toggle. Removing this block
 * requires a reviewed release with live Price IDs, atomic provider cost caps,
 * subscription migrations, tax disclosure and paid customer acceptance.
 * Mocked Stripe tests can continue without real payments.
 */
export const COMMERCIAL_CHECKOUT_PAUSED =
  "AppForge checkout is temporarily unavailable while billing fulfillment and release qualification are completed. Existing account access is unchanged.";

export function assertCommercialCheckoutReleased(
  environment: string | undefined = process.env.NODE_ENV,
): void {
  if (environment !== "test" && environment !== "development") {
    throw new Error(COMMERCIAL_CHECKOUT_PAUSED);
  }
}
