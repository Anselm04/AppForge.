import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webhook = readFileSync(
  resolve(process.cwd(), "src/webhooks/stripe.ts"),
  "utf8",
);

describe("Stripe monthly plan credit grants", () => {
  it("grants monthly credits only for subscription creation or renewal invoices", () => {
    expect(webhook).toContain('invoice.billing_reason === "subscription_create"');
    expect(webhook).toContain('invoice.billing_reason === "subscription_cycle"');
    expect(webhook).toContain("shouldGrantMonthlyPlanCredits(invoice)");
    expect(webhook).toContain(
      "stripe_invoice_plan_credit_grant_skipped_for_billing_reason",
    );
  });
});
