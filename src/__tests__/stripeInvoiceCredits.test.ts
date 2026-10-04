import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { resolveInvoiceCreditTier } from "../services/stripeInvoiceCredits.js";

function invoice(lines: unknown[], hasMore = false): Stripe.Invoice {
  return { lines: { data: lines, has_more: hasMore } } as Stripe.Invoice;
}
const plan = (id: string) => ({
  type: "subscription",
  proration: false,
  quantity: 1,
  price: { id },
});
const tier = (id: string | null) =>
  id === "price_starter" ? "starter" : id === "price_studio" ? "studio" : null;

describe("paid invoice credit tier", () => {
  it("grants the historical paid starter tier even after a studio upgrade", () => {
    expect(
      resolveInvoiceCreditTier(invoice([plan("price_starter")]), tier),
    ).toBe("starter");
  });
  it("ignores proration adjustments and reads the billed renewal plan", () => {
    expect(
      resolveInvoiceCreditTier(
        invoice([
          { ...plan("price_starter"), proration: true },
          plan("price_studio"),
        ]),
        tier,
      ),
    ).toBe("studio");
  });
  it.each([
    [],
    [plan("price_other_product")],
    [plan("price_starter"), plan("price_studio")],
    [{ ...plan("price_starter"), quantity: 2 }],
    [{ ...plan("price_starter"), proration: true }],
  ])("refuses ambiguous or foreign invoice lines %j", (...lines) => {
    // it.each arrays are argument rows; reconstruct the invoice line list.
    expect(() => resolveInvoiceCreditTier(invoice(lines), tier)).toThrow();
  });
  it("refuses incomplete paginated invoice lines", () => {
    expect(() =>
      resolveInvoiceCreditTier(invoice([plan("price_starter")], true), tier),
    ).toThrow("Incomplete");
  });
});
