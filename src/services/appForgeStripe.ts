import Stripe from "stripe";

/**
 * AppForge may share a Stripe account with other independent products.
 * Product isolation is enforced by AppForge-owned price IDs, webhook handling,
 * metadata and entitlement records — never by requiring a dedicated Stripe account.
 */
export async function getAppForgeStripe(): Promise<Stripe> {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("Stripe not configured");
  return new Stripe(key, { apiVersion: "2024-06-20" as any });
}
