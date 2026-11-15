import type Stripe from "stripe";
import { AFTERCARE_PLUS_PRICE_ID } from "./appForgePricePolicy.js";
import {
  invoiceLinePriceId,
  subscriptionInvoiceLine,
} from "./stripeInvoiceCompatibility.js";

/** Credits reflect the settled invoice, even if a later plan change already happened. */
export function resolveInvoiceCreditTier(
  invoice: Stripe.Invoice,
  tierForPrice: (priceId: string | null) => string | null,
): string {
  if (invoice.lines.has_more) {
    throw new Error("Incomplete Stripe invoice lines; refusing credit grant");
  }
  const lines = invoice.lines.data.filter(subscriptionInvoiceLine);
  const planLines = lines.filter(
    (line) => tierForPrice(invoiceLinePriceId(line)) !== null,
  );
  const otherLines = lines.filter(
    (line) => tierForPrice(invoiceLinePriceId(line)) === null,
  );
  if (
    planLines.length !== 1 ||
    planLines[0].quantity !== 1 ||
    otherLines.some(
      (line) =>
        invoiceLinePriceId(line) !== AFTERCARE_PLUS_PRICE_ID ||
        line.quantity !== 1,
    ) ||
    otherLines.length > 1
  ) {
    throw new Error(
      "Stripe invoice must contain one non-prorated AppForge plan",
    );
  }
  const tier = tierForPrice(invoiceLinePriceId(planLines[0]));
  if (!tier) throw new Error("Unrecognized paid AppForge invoice price");
  return tier;
}
