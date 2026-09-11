import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Stripe revenue fulfillment boundaries", () => {
  it("fulfills one-time credits from the actual paid Stripe price", () => {
    const webhook = source("src/webhooks/stripe.ts");

    expect(webhook).toContain("stripe.checkout.sessions.listLineItems");
    expect(webhook).toContain('session.payment_status !== "paid"');
    expect(webhook).toContain("creditPackFromPriceId(paidPriceId)");
    expect(webhook).toContain("(lineItem.quantity ?? 0) !== 1");
    expect(webhook).toContain("Stripe credit metadata mismatch");
  });

  it("grants recurring plan credits only from paid subscription invoices", () => {
    const webhook = source("src/webhooks/stripe.ts");
    const checkoutCase = webhook.slice(
      webhook.indexOf('case "checkout.session.completed"'),
      webhook.indexOf('case "invoice.paid"'),
    );
    const invoiceCase = webhook.slice(
      webhook.indexOf('case "invoice.paid"'),
      webhook.indexOf('case "invoice.payment_failed"'),
    );

    expect(checkoutCase).not.toContain("grantPlanCredits(");
    expect(invoiceCase).toContain("grantPlanCredits(userId, tier, invoice.id)");
    expect(invoiceCase).toContain("shouldGrantMonthlyPlanCredits(invoice)");
  });

  it("rejects conflicting checkout user identities", () => {
    const webhook = source("src/webhooks/stripe.ts");

    expect(webhook).toContain("Stripe checkout user reference mismatch");
    expect(webhook).toContain("metadataUserId !== referenceUserId");
  });
});
