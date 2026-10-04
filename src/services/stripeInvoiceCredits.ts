import type Stripe from "stripe";

/** Credits reflect the settled invoice, even if a later plan change already happened. */
export function resolveInvoiceCreditTier(
  invoice: Stripe.Invoice,
  tierForPrice: (priceId: string | null) => string | null,
): string {
  if (invoice.lines.has_more) {
    throw new Error("Incomplete Stripe invoice lines; refusing credit grant");
  }
  const lines = invoice.lines.data.filter(
    (line) => line.type === "subscription" && !line.proration,
  );
  if (lines.length !== 1 || lines[0].quantity !== 1) {
    throw new Error(
      "Stripe invoice must contain one non-prorated AppForge plan",
    );
  }
  const tier = tierForPrice(lines[0].price?.id ?? null);
  if (!tier) throw new Error("Unrecognized paid AppForge invoice price");
  return tier;
}
