import type Stripe from "stripe";

export type AppForgeStripeOwnership =
  "appforge" | "foreign" | "invalid_appforge";

function productLine(metadata?: Stripe.Metadata | null): string {
  return (metadata?.product_line || "").trim().toLowerCase();
}

function declaredTier(metadata?: Stripe.Metadata | null): string {
  return (metadata?.tier || metadata?.plan || "").trim().toLowerCase();
}

/**
 * Classify a subscription event arriving on a Stripe account shared by multiple
 * independent products.
 *
 * - A configured AppForge Price ID is AppForge, even for legacy subscriptions
 *   that predate product_line metadata.
 * - product_line=appforge is authoritative intent, but a standard subscription
 *   carrying that marker with an unconfigured Price ID is invalid and must fail
 *   closed rather than grant an entitlement.
 * - Custom AppForge subscriptions may intentionally be contract-priced and are
 *   therefore accepted when explicitly marked as AppForge + tier=custom.
 * - Everything else belongs to another product and must be ignored by AppForge.
 */
export function classifyAppForgeSubscription(
  metadata: Stripe.Metadata | null | undefined,
  hasConfiguredAppForgePrice: boolean,
): AppForgeStripeOwnership {
  const markedAppForge = productLine(metadata) === "appforge";

  if (hasConfiguredAppForgePrice) return "appforge";
  if (!markedAppForge) return "foreign";
  if (declaredTier(metadata) === "custom") return "appforge";
  return "invalid_appforge";
}

/** Credit purchases created by AppForge always carry the AppForge namespace. */
export function isAppForgeCreditMetadata(
  metadata?: Stripe.Metadata | null,
): boolean {
  return productLine(metadata) === "appforge";
}
