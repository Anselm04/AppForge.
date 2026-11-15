import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { AFTERCARE_PLUS_PRICE_ID } from "../services/appForgePricePolicy.js";
import { resolveInvoiceCreditTier } from "../services/stripeInvoiceCredits.js";
import {
  invoiceSubscriptionId,
  subscriptionBillingPeriod,
} from "../services/stripeInvoiceCompatibility.js";

const tier = (price: string | null) =>
  price === "price_starter"
    ? "starter"
    : price === "price_studio"
      ? "studio"
      : null;

function line(price: string, proration = false) {
  return {
    parent: {
      type: "subscription_item_details",
      subscription_item_details: { proration },
    },
    pricing: { price_details: { price } },
    quantity: 1,
    period: { start: 1763200000, end: 1765792000 },
  };
}

function invoice(lines: unknown[], more = false): Stripe.Invoice {
  return { lines: { data: lines, has_more: more } } as Stripe.Invoice;
}

describe("Stripe API schema compatibility (offline)", () => {
  it("grants only the non-prorated plan from modern invoice line objects", () => {
    expect(
      resolveInvoiceCreditTier(
        invoice([
          line("price_starter", true),
          line("price_studio"),
          line(AFTERCARE_PLUS_PRICE_ID),
        ]),
        tier,
      ),
    ).toBe("studio");
  });

  it("refuses modern ambiguous plans and incomplete invoices", () => {
    expect(() =>
      resolveInvoiceCreditTier(
        invoice([line("price_starter"), line("price_studio")]),
        tier,
      ),
    ).toThrow();
    expect(() =>
      resolveInvoiceCreditTier(invoice([line("price_starter")], true), tier),
    ).toThrow("Incomplete");
    expect(() =>
      resolveInvoiceCreditTier(invoice([line("price_starter", true)]), tier),
    ).toThrow();
  });

  it("resolves modern parent subscription, legacy reference and no subscription", () => {
    const modern = {
      parent: { subscription_details: { subscription: "sub_modern" } },
    } as Stripe.Invoice;
    const legacy = {
      subscription: { id: "sub_legacy" },
    } as unknown as Stripe.Invoice;
    expect(invoiceSubscriptionId(modern)).toBe("sub_modern");
    expect(invoiceSubscriptionId(legacy)).toBe("sub_legacy");
    expect(invoiceSubscriptionId({} as Stripe.Invoice)).toBeNull();
  });

  it("reads subscription-item billing periods after Stripe removed the parent-level fields", () => {
    const subscription = {
      items: {
        data: [
          { current_period_start: 1763200000, current_period_end: 1765792000 },
        ],
      },
    } as unknown as Stripe.Subscription;
    const period = subscriptionBillingPeriod(subscription);
    expect(period.start?.getTime()).toBe(1763200000 * 1000);
    expect(period.end?.getTime()).toBe(1765792000 * 1000);
  });

  it("retains nullable period for legacy subscriptions and rejects partial item dates", () => {
    const legacy = {
      items: { data: [{ price: { id: "price_studio" } }] },
    } as unknown as Stripe.Subscription;
    expect(subscriptionBillingPeriod(legacy)).toEqual({
      start: null,
      end: null,
    });
    const malformed = {
      items: { data: [{ current_period_start: 1763200000 }] },
    } as unknown as Stripe.Subscription;
    expect(() => subscriptionBillingPeriod(malformed)).toThrow(
      "Missing Stripe",
    );
  });

  it("fails closed when subscription items have conflicting billing periods", () => {
    const subscription = {
      items: {
        data: [
          { current_period_start: 1763200000, current_period_end: 1765792000 },
          { current_period_start: 1763200000, current_period_end: 1765878400 },
        ],
      },
    } as unknown as Stripe.Subscription;
    expect(() => subscriptionBillingPeriod(subscription)).toThrow("Mixed");
  });
});
