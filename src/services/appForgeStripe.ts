import Stripe from "stripe";

/** Billing uses the dedicated AppForge account, never an ambient shared account. */
export async function verifyAppForgeStripeAccount(
  stripe: Stripe,
): Promise<void> {
  const expected = process.env.APPFORGE_STRIPE_ACCOUNT_ID?.trim();
  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Dedicated AppForge Stripe account is not configured");
    }
    return;
  }
  if (!/^acct_[A-Za-z0-9]+$/.test(expected)) {
    throw new Error("Invalid AppForge Stripe account identifier");
  }
  const account = await stripe.accounts.retrieve();
  if (account.id !== expected) {
    throw new Error(
      "Stripe credentials do not belong to the dedicated AppForge account",
    );
  }
}

export async function getAppForgeStripe(): Promise<Stripe> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe not configured");
  const stripe = new Stripe(key, { apiVersion: "2024-06-20" as any });
  await verifyAppForgeStripeAccount(stripe);
  return stripe;
}
