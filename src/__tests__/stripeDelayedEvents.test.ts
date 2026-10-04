import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { PgDialect } from "drizzle-orm/pg-core";

const mocks = vi.hoisted(() => ({
  event: {} as { type: string; id: string; data: { object: unknown } },
  retrieve: vi.fn(),
  findFirst: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  addCredits: vi.fn(),
  lineItems: vi.fn(),
  refund: vi.fn(),
  charge: vi.fn(),
  payment: vi.fn(),
  values: vi.fn(),
  conflict: vi.fn(),
  grant: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class {
    webhooks = { constructEvent: () => mocks.event };
    subscriptions = { retrieve: mocks.retrieve };
    checkout = { sessions: { listLineItems: mocks.lineItems } };
    charges = { retrieve: mocks.charge };
    paymentIntents = { retrieve: mocks.payment };
  },
}));
vi.mock("../db.js", () => ({
  addCredits: mocks.addCredits,
  db: {
    transaction: async (handler: (tx: unknown) => Promise<unknown>) =>
      handler({
        execute: vi.fn(),
        query: { subscriptions: { findFirst: mocks.findFirst } },
        insert: () => ({ values: mocks.values }),
      }),
    query: { subscriptions: { findFirst: mocks.findFirst } },
    update: () => ({ set: mocks.set }),
    insert: () => ({ values: mocks.values }),
  },
}));
vi.mock("../services/stripeCheckout.js", () => ({
  CREDIT_PACKS: [50, 100, 250],
}));
vi.mock("../services/stripeCreditRefund.js", () => ({
  reconcileCreditPurchaseRefund: mocks.refund,
}));
vi.mock("../services/stripePlanCredits.js", () => ({
  grantStripeInvoicePlanCredits: mocks.grant,
}));
vi.mock("../services/stripeEventLedger.js", () => ({
  processStripeEventOnce: async (
    _id: string,
    _type: string,
    handler: () => Promise<void>,
  ) => handler(),
}));
vi.mock("../_core/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../lib/operationsObservability.js", () => ({
  incrementOperationalMetric: vi.fn(),
}));

async function deliver(type: string, object: unknown) {
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_placeholder");
  vi.resetModules();
  mocks.event = { id: "evt_delayed", type, data: { object } };
  const { handleStripeWebhook } = await import("../webhooks/stripe.js");
  const response = { status: vi.fn(), json: vi.fn() };
  response.status.mockReturnValue(response);
  await handleStripeWebhook(
    {
      headers: { "stripe-signature": "signed-test-event" },
      body: Buffer.from("test"),
    } as unknown as Request,
    response as unknown as Response,
  );
  return response;
}

beforeEach(() => {
  mocks.retrieve.mockReset();
  mocks.findFirst.mockReset();
  mocks.values.mockClear();
  mocks.grant.mockReset().mockResolvedValue({ granted: 50, skipped: false });
  mocks.set.mockImplementation(() => ({ where: mocks.where }));
  mocks.where.mockResolvedValue(undefined);
  mocks.addCredits.mockResolvedValue(50);
  mocks.lineItems.mockResolvedValue({
    data: [{ quantity: 1, price: { id: "price_credit50" } }],
  });
  mocks.values.mockReturnValue({ onConflictDoUpdate: mocks.conflict });
  mocks.conflict.mockResolvedValue(undefined);
  vi.stubEnv("STRIPE_CREDITS_50_PRICE_ID", "price_credit50");
  vi.stubEnv("STRIPE_STUDIO_PRICE_ID", "price_studio");
  vi.stubEnv("STRIPE_STARTER_PRICE_ID", "price_starter");
});

describe("delayed Stripe subscription events", () => {
  it("allows a new subscription after the old one is terminal", async () => {
    mocks.findFirst.mockResolvedValue({
      userId: 42,
      stripeSubscriptionId: "sub_old",
    });
    mocks.retrieve.mockImplementation(async (id: string) => ({
      id,
      customer: "cus_owner",
      status: id === "sub_old" ? "canceled" : "active",
      metadata: { userId: "42" },
      items: { data: [{ price: { id: "price_studio" } }] },
    }));
    const res = await deliver("customer.subscription.created", {
      id: "sub_new",
    });
    expect(mocks.values).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeSubscriptionId: "sub_new",
        status: "active",
      }),
    );
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });
  it("retries without overwriting billing when replacement lookup fails", async () => {
    mocks.findFirst.mockResolvedValue({
      userId: 42,
      stripeSubscriptionId: "sub_new",
    });
    mocks.retrieve.mockImplementation(async (id: string) => {
      if (id === "sub_new") throw new Error("Stripe unavailable");
      return {
        id,
        customer: "cus_owner",
        status: "canceled",
        metadata: { userId: "42" },
        items: { data: [{ price: { id: "price_starter" } }] },
      };
    });
    const res = await deliver("customer.subscription.updated", {
      id: "sub_old",
    });
    expect(mocks.values).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });
  it("keeps a replacement subscription when an old paid invoice arrives", async () => {
    mocks.findFirst.mockResolvedValue({
      userId: 42,
      stripeSubscriptionId: "sub_new",
    });
    mocks.retrieve.mockImplementation(async (id: string) => ({
      id,
      customer: "cus_owner",
      status: id === "sub_new" ? "active" : "canceled",
      metadata: { userId: "42" },
      items: {
        data: [
          {
            price: { id: id === "sub_new" ? "price_studio" : "price_starter" },
          },
        ],
      },
    }));
    const res = await deliver("invoice.paid", {
      id: "in_old",
      subscription: "sub_old",
      billing_reason: "subscription_cycle",
      lines: {
        has_more: false,
        data: [
          {
            type: "subscription",
            proration: false,
            quantity: 1,
            price: { id: "price_starter" },
          },
        ],
      },
    });
    expect(mocks.values).not.toHaveBeenCalled();
    expect(mocks.grant).toHaveBeenCalledWith(42, "starter", "in_old", "studio");
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });
  it("uses the same payment identity for expanded completed checkout references", async () => {
    await deliver("checkout.session.completed", {
      id: "cs_paid",
      mode: "payment",
      payment_status: "paid",
      payment_intent: { id: "pi_paid" },
      metadata: { product_line: "appforge", userId: "42", credits: "50" },
    });
    expect(mocks.addCredits).toHaveBeenCalledWith(
      42,
      50,
      "purchase",
      expect.any(String),
      "pi_paid",
    );
  });
  it("acknowledges an unrelated product checkout without minting AppForge credits", async () => {
    const res = await deliver("checkout.session.completed", {
      id: "cs_other_product",
      mode: "payment",
      payment_status: "paid",
      payment_intent: "pi_other_product",
      metadata: {
        product_line: "marketing-app",
        userId: "42",
        credits: "50",
      },
    });
    expect(mocks.lineItems).not.toHaveBeenCalled();
    expect(mocks.addCredits).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });
  it("acknowledges an unsettled credit checkout without minting credits", async () => {
    const res = await deliver("checkout.session.completed", {
      id: "cs_waiting",
      mode: "payment",
      payment_status: "unpaid",
      metadata: { product_line: "appforge", userId: "42", credits: "50" },
    });
    expect(mocks.addCredits).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });
  it("fulfills a delayed settled payment against its PaymentIntent identity", async () => {
    const res = await deliver("checkout.session.async_payment_succeeded", {
      id: "cs_paid",
      mode: "payment",
      payment_status: "paid",
      payment_intent: "pi_paid",
      metadata: { product_line: "appforge", userId: "42", credits: "50" },
    });
    expect(mocks.addCredits).toHaveBeenCalledWith(
      42,
      50,
      "purchase",
      expect.any(String),
      "pi_paid",
    );
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });
  it("rejects a foreign credit price before writing credits", async () => {
    mocks.lineItems.mockResolvedValue({
      data: [{ quantity: 1, price: { id: "price_marketing" } }],
    });
    const res = await deliver("checkout.session.async_payment_succeeded", {
      id: "cs_other",
      mode: "payment",
      payment_status: "paid",
      payment_intent: "pi_other",
      metadata: { product_line: "appforge", userId: "42", credits: "50" },
    });
    expect(mocks.addCredits).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });
  it("uses current subscription state instead of a stale update snapshot", async () => {
    mocks.retrieve.mockResolvedValue({
      id: "sub_current",
      customer: "cus_owner",
      status: "active",
      metadata: { userId: "42" },
      items: { data: [{ price: { id: "price_studio" } }] },
    });
    const res = await deliver("customer.subscription.updated", {
      id: "sub_current",
      status: "past_due",
      metadata: { tier: "starter" },
    });
    expect(mocks.values).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 42, status: "active", tier: "studio" }),
    );
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });
  it("retries a credit refund delivered before purchase fulfillment", async () => {
    mocks.charge.mockResolvedValue({
      id: "ch_paid",
      payment_intent: "pi_paid",
      amount: 5000,
      amount_refunded: 5000,
      refunded: true,
    });
    mocks.refund.mockResolvedValue({ purchaseMissing: true, skipped: true });
    mocks.payment.mockResolvedValue({
      metadata: { product_line: "appforge", credits: "50" },
    });
    const res = await deliver("charge.refunded", {
      id: "ch_paid",
      amount_refunded: 2500,
    });
    expect(mocks.refund).toHaveBeenCalledWith(
      "pi_paid",
      "evt_delayed",
      5000,
      5000,
      true,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
  it.each(["active", "trialing", "canceled", "unpaid", "past_due"])(
    "keeps Stripe's current %s status when an old payment failure arrives",
    async (status) => {
      mocks.retrieve.mockResolvedValue({
        id: "sub_current",
        status,
        metadata: { product_line: "appforge", userId: "42" },
        items: { data: [{ price: { id: "price_starter" } }] },
      });
      const res = await deliver("invoice.payment_failed", {
        subscription: "sub_current",
      });
      expect(mocks.retrieve).toHaveBeenCalledWith("sub_current");
      expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ status }));
      expect(res.json).toHaveBeenCalledWith({ received: true });
    },
  );

  it("returns a retryable error without changing billing when Stripe lookup fails", async () => {
    mocks.retrieve.mockRejectedValue(
      new Error("Stripe temporarily unavailable"),
    );
    const res = await deliver("invoice.payment_failed", {
      subscription: "sub_current",
    });
    expect(mocks.set).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("handles expanded invoice subscription references", async () => {
    mocks.retrieve.mockResolvedValue({
      id: "sub_current",
      status: "active",
      metadata: { product_line: "appforge", userId: "42" },
      items: { data: [{ price: { id: "price_starter" } }] },
    });
    await deliver("invoice.payment_failed", {
      subscription: { id: "sub_current" },
    });
    expect(mocks.retrieve).toHaveBeenCalledWith("sub_current");
  });

  it("scopes a late cancellation to the canceled subscription, protecting a replacement", async () => {
    mocks.findFirst.mockResolvedValue({
      userId: 42,
      stripeSubscriptionId: "sub_replacement",
    });
    const res = await deliver("customer.subscription.deleted", {
      id: "sub_old",
      customer: "cus_owner",
      metadata: { product_line: "appforge", userId: "42" },
      items: { data: [{ price: { id: "price_starter" } }] },
    });
    const query = new PgDialect().sqlToQuery(mocks.where.mock.calls[0][0]);
    expect(query.sql).toContain('"stripe_subscription_id"');
    expect(query.params).toEqual([42, "sub_old"]);
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });
});
