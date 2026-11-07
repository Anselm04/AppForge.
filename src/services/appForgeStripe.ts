import Stripe from "stripe";

/**
 * AppForge may share a Stripe account with other independent products.
 * Product isolation is enforced by AppForge-owned price IDs, webhook handling,
 * metadata and entitlement records — never by requiring a dedicated Stripe account.
 */
export async function getAppForgeStripe(): Promise<Stripe> {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("Stripe not configured");
  const liveKey = /^(?:sk|rk)_live_/.test(key);
  if (process.env.NODE_ENV === "production" && !liveKey) {
    throw new Error("Production Stripe operations require a live Stripe key");
  }
  if (process.env.NODE_ENV !== "production" && liveKey) {
    throw new Error("Live Stripe keys are prohibited outside production");
  }
  return new Stripe(key, { apiVersion: "2024-06-20" as any });
}
