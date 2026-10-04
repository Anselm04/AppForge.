import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { PgDialect } from "drizzle-orm/pg-core";

const mocks = vi.hoisted(() => ({
  event: {} as { type: string; id: string; data: { object: unknown } },
  retrieve: vi.fn(),
  findFirst: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class {
    webhooks = { constructEvent: () => mocks.event };
    subscriptions = { retrieve: mocks.retrieve };
  },
}));
vi.mock("../db.js", () => ({
  addCredits: vi.fn(),
  db: {
    query: { subscriptions: { findFirst: mocks.findFirst } },
    update: () => ({ set: mocks.set }),
  },
}));
vi.mock("../services/stripeCheckout.js", () => ({
  CREDIT_PACKS: [50, 100, 250],
}));
vi.mock("../services/stripeCreditRefund.js", () => ({
  reconcileCreditPurchaseRefund: vi.fn(),
}));
vi.mock("../services/stripePlanCredits.js", () => ({
  grantStripeInvoicePlanCredits: vi.fn(),
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
  mocks.set.mockImplementation(() => ({ where: mocks.where }));
  mocks.where.mockResolvedValue(undefined);
});

describe("delayed Stripe subscription events", () => {
  it.each(["active", "trialing", "canceled", "unpaid", "past_due"])(
    "keeps Stripe's current %s status when an old payment failure arrives",
    async (status) => {
      mocks.retrieve.mockResolvedValue({ id: "sub_current", status });
      const res = await deliver("invoice.payment_failed", {
        subscription: "sub_current",
      });
      expect(mocks.retrieve).toHaveBeenCalledWith("sub_current");
      expect(mocks.set).toHaveBeenCalledWith(
        expect.objectContaining({ status }),
      );
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
    mocks.retrieve.mockResolvedValue({ id: "sub_current", status: "active" });
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
      metadata: { userId: "42" },
    });
    const query = new PgDialect().sqlToQuery(mocks.where.mock.calls[0][0]);
    expect(query.sql).toContain('"stripe_subscription_id"');
    expect(query.params).toEqual([42, "sub_old"]);
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });
});
