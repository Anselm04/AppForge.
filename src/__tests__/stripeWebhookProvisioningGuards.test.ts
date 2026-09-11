import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/webhooks/stripe.ts"),
  "utf8",
);

describe("Stripe webhook provisioning guards", () => {
  it("requires safe positive user identifiers", () => {
    expect(source).toContain("function parsePositiveUserId");
    expect(source).toContain("Number.isSafeInteger(userId) && userId > 0");
  });

  it("rejects conflicting checkout user references", () => {
    expect(source).toContain("function resolveCheckoutUserId");
    expect(source).toContain("Stripe checkout user reference mismatch");
  });

  it("only provisions configured credit-pack sizes after settled payment", () => {
    expect(source).toContain(
      "const CREDIT_PACK_SET = new Set<number>(CREDIT_PACKS)",
    );
    expect(source).toContain('session.payment_status !== "paid"');
    expect(source).toContain("stripe.checkout.sessions.listLineItems");
    expect(source).toContain("(lineItem.quantity ?? 0) !== 1");
    expect(source).toContain("creditPackFromPriceId(paidPriceId)");
    expect(source).toContain(
      "Unrecognized Stripe credit price; refusing fulfillment",
    );
    expect(source).toContain("Stripe credit metadata mismatch");
  });

  it("requires a concrete Stripe customer before subscription provisioning", () => {
    expect(source).toContain("function customerIdFromSubscription");
    expect(source).toContain("Stripe subscription customer is missing");
  });
});
