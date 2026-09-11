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

  it("routes partial and full credit-pack refunds through deterministic reconciliation", () => {
    const webhook = source("src/webhooks/stripe.ts");
    const refund = source("src/services/stripeCreditRefund.ts");

    expect(webhook).toContain('case "charge.refunded"');
    expect(webhook).toContain("reconcileCreditPurchaseRefund(");
    expect(webhook).toContain("charge.amount_refunded");
    expect(webhook).not.toContain(
      "stripe_partial_refund_requires_manual_credit_reconciliation",
    );
    expect(refund).toContain("calculateCreditRefundAdjustment({");
    expect(refund).toContain("stateKey = `stripe_refund:${paymentIntentId}`");
    expect(refund).toContain("accountedCredits");
    expect(refund).toContain("Math.min(credits.balance, delta)");
    expect(refund).toContain('type: "purchase_refund"');
    expect(refund).toContain("stripePaymentIntentId: refundEventId");
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

    expect(checkoutCase).not.toContain("grantStripeInvoicePlanCredits(");
    expect(invoiceCase).toContain("grantStripeInvoicePlanCredits(");
    expect(invoiceCase).toContain("invoice.id");
    expect(invoiceCase).toContain("shouldGrantMonthlyPlanCredits(invoice)");
  });

  it("resolves the paid plan from the current Stripe subscription before granting", () => {
    const webhook = source("src/webhooks/stripe.ts");
    const invoiceCase = webhook.slice(
      webhook.indexOf('case "invoice.paid"'),
      webhook.indexOf('case "invoice.payment_failed"'),
    );

    const retrieveAt = invoiceCase.indexOf(
      "stripe.subscriptions.retrieve(subscriptionId)",
    );
    const grantAt = invoiceCase.indexOf("grantStripeInvoicePlanCredits(");
    expect(retrieveAt).toBeGreaterThanOrEqual(0);
    expect(grantAt).toBeGreaterThan(retrieveAt);
    expect(invoiceCase).toContain(
      "resolveTier(subscription.metadata, priceId)",
    );
  });

  it("rejects conflicting Stripe/AppForge user identities", () => {
    const webhook = source("src/webhooks/stripe.ts");

    expect(webhook).toContain("Stripe checkout user reference mismatch");
    expect(webhook).toContain("metadataUserId !== referenceUserId");
    expect(webhook).toContain("Stripe subscription user identity mismatch");
    expect(webhook).toContain("resolveConsistentUserId(");
  });

  it("uses the Stripe invoice ID as the exact recurring-credit idempotency key", () => {
    const grants = source("src/services/stripePlanCredits.ts");

    expect(grants).toContain('invoiceId.startsWith("in_")');
    expect(grants).toContain(
      "eq(schema.creditTransactions.stripePaymentIntentId, invoiceId)",
    );
    expect(grants).toContain("stripePaymentIntentId: invoiceId");
    expect(grants).not.toContain("daysSinceGrant");
    expect(grants).not.toContain("25");
  });

  it("provisions the replay ledger at startup instead of during a webhook", () => {
    const schema = source("src/db/ensureSchema.ts");
    const ledger = source("src/services/stripeEventLedger.ts");

    expect(schema).toContain(
      'CREATE TABLE IF NOT EXISTS "stripe_webhook_events"',
    );
    expect(schema).toContain('"event_id" VARCHAR(255) PRIMARY KEY');
    expect(ledger).not.toContain("CREATE TABLE");
    expect(ledger).not.toContain("CREATE INDEX");
    expect(ledger).toContain("pg_advisory_xact_lock");
  });
});
