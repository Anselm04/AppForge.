import type Stripe from "stripe";

/**
 * Strict compatibility for Stripe webhook payloads from both the 2024-06-20
 * API still pinned by AppForge and newer Stripe SDK 23 type definitions.
 * This is original AppForge code; it never calls Stripe and never grants credits.
 */
type Reference = string | { id?: string } | null | undefined;
type InvoiceLineShape = {
  type?: string;
  proration?: boolean;
  price?: { id?: string } | null;
  parent?: {
    type?: string;
    subscription_item_details?: { proration?: boolean } | null;
  } | null;
  pricing?: { price_details?: { price?: string } | null } | null;
};

export function subscriptionInvoiceLine(line: Stripe.InvoiceLineItem): boolean {
  const value = line as unknown as InvoiceLineShape;
  if (value.parent) {
    return (
      value.parent.type === "subscription_item_details" &&
      value.parent.subscription_item_details?.proration === false
    );
  }
  return value.type === "subscription" && value.proration !== true;
}

export function invoiceLinePriceId(
  line: Stripe.InvoiceLineItem,
): string | null {
  const value = line as unknown as InvoiceLineShape;
  const price = value.pricing?.price_details?.price ?? value.price?.id;
  return typeof price === "string" && price.length > 0 ? price : null;
}

function idFromReference(value: Reference): string | null {
  if (typeof value === "string") return value || null;
  return value && typeof value.id === "string" ? value.id : null;
}

export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const value = invoice as unknown as {
    subscription?: Reference;
    parent?: {
      subscription_details?: { subscription?: Reference } | null;
    } | null;
  };
  return idFromReference(
    value.parent?.subscription_details?.subscription ?? value.subscription,
  );
}

export function subscriptionBillingPeriod(subscription: Stripe.Subscription): {
  start: Date | null;
  end: Date | null;
} {
  const legacy = subscription as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  };
  if (legacy.current_period_start && legacy.current_period_end) {
    return {
      start: new Date(legacy.current_period_start * 1000),
      end: new Date(legacy.current_period_end * 1000),
    };
  }
  const items = subscription.items?.data ?? [];
  if (items.length === 0) return { start: null, end: null };
  const periods = items.map((item) => {
    const current = item as unknown as {
      current_period_start?: number;
      current_period_end?: number;
    };
    return [current.current_period_start, current.current_period_end] as const;
  });
  const [firstStart, firstEnd] = periods[0];
  // Existing provider mocks and legacy subscriptions can omit item periods.
  // Preserve null periods for those records, but never accept partial or
  // conflicting dates as a paid billing period.
  if (periods.every(([start, end]) => !start && !end)) {
    return { start: null, end: null };
  }
  if (!firstStart || !firstEnd || firstStart >= firstEnd) {
    throw new Error("Missing Stripe subscription item billing period");
  }
  if (
    periods.some(([start, end]) => start !== firstStart || end !== firstEnd)
  ) {
    throw new Error(
      "Mixed Stripe subscription item billing periods need explicit plan selection",
    );
  }
  return { start: new Date(firstStart * 1000), end: new Date(firstEnd * 1000) };
}
