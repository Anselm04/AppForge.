import type Stripe from "stripe";

export type AppForgeStripeOwnership =
  "appforge" | "foreign" | "invalid_appforge";

function productLine(metadata?: Stripe.Metadata | null): string {
  return (metadata?.product_line || "").trim().toLowerCase();
}

function declaredTier(metadata?: Stripe.Metadata | null): string {
  return (metadata?.tier || metadata?.plan || "").trim().toLowerCase();
}

function hasValidUserId(metadata?: Stripe.Metadata | null): boolean {
  const raw = (metadata?.userId || "").trim();
  if (!/^\d+$/.test(raw)) return false;
  const userId = Number(raw);
  return Number.isSafeInteger(userId) && userId > 0;
}

/**
 * Classify a subscription event arriving on a Stripe account shared by multiple
 * independent products.
 *
 * - A configured AppForge Price ID is AppForge, even for legacy subscriptions
 *   that predate product_line metadata.
 * - Explicitly marked AppForge events must also carry a valid AppForge userId;
 *   otherwise they fail closed so Stripe retries instead of silently dropping a
 *   paid entitlement.
 * - product_line=appforge is authoritative intent, but a standard subscription
 *   carrying that marker with an unconfigured Price ID is invalid and must fail
 *   closed rather than grant an entitlement.
 * - Custom AppForge subscriptions may intentionally be contract-priced and are
 *   accepted only when explicitly marked as AppForge + tier=custom + userId.
 * - Everything else belongs to another product and must be ignored by AppForge.
 */
export function classifyAppForgeSubscription(
  metadata: Stripe.Metadata | null | undefined,
  hasConfiguredAppForgePrice: boolean,
): AppForgeStripeOwnership {
  const markedAppForge = productLine(metadata) === "appforge";

  if (markedAppForge && !hasValidUserId(metadata)) return "invalid_appforge";
  if (hasConfiguredAppForgePrice) return "appforge";
  if (!markedAppForge) return "foreign";
  if (declaredTier(metadata) === "custom") return "appforge";
  return "invalid_appforge";
}

/** Credit purchases created by AppForge always carry namespace + user identity. */
export function isAppForgeCreditMetadata(
  metadata?: Stripe.Metadata | null,
): boolean {
  if (productLine(metadata) !== "appforge") return false;
  if (!hasValidUserId(metadata)) {
    throw new Error("AppForge Stripe metadata is missing a valid userId");
  }
  return true;
}
