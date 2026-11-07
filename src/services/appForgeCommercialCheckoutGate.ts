/**
 * The owner approved the subscription amounts, but has not yet approved
 * credit-pack economics or live Stripe cutover. Existing configured Stripe
 * Prices still point to the old catalogue. Therefore no *new* checkout
 * session is issued by this proposed commercial release in production.
 *
 * This is intentionally NOT a boolean env toggle. Removing this block
 * requires a reviewed release with live Price IDs, atomic provider cost caps,
 * subscription migrations, tax disclosure and paid customer acceptance.
 * Mocked Stripe tests can continue without real payments.
 */
export const COMMERCIAL_CHECKOUT_PAUSED =
  "AppForge is finalising the approved USD plans and credit pricing. New subscription purchases and credit top-ups are temporarily unavailable. Existing account access is unchanged.";

export function assertCommercialCheckoutReleased(
  environment: string | undefined = process.env.NODE_ENV,
): void {
  if (environment !== "test" && environment !== "development") {
    throw new Error(COMMERCIAL_CHECKOUT_PAUSED);
  }
}
