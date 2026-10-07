import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const mocks = vi.hoisted(() => ({
  event: {} as { type: string; id: string; data: { object: unknown } },
  retrieve: vi.fn(),
  findFirst: vi.fn(),
  values: vi.fn(),
  conflict: vi.fn(),
  addCredits: vi.fn(),
  lineItems: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class {
    webhooks = { constructEvent: () => mocks.event };
    subscriptions = { retrieve: mocks.retrieve };
    checkout = { sessions: { listLineItems: mocks.lineItems } };
    charges = { retrieve: vi.fn() };
    paymentIntents = { retrieve: vi.fn() };
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
    update: () => ({ set: () => ({ where: vi.fn() }) }),
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
  vi.stubEnv("STRIPE_STARTER_PRICE_ID", "price_starter");
  vi.stubEnv("STRIPE_CREDITS_50_PRICE_ID", "price_credit50");
  vi.resetModules();
  mocks.event = { id: `evt_${type}`, type, data: { object } };

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
  mocks.findFirst.mockReset().mockResolvedValue(undefined);
  mocks.values.mockReset();
  mocks.conflict.mockReset().mockResolvedValue(undefined);
  mocks.values.mockReturnValue({ onConflictDoUpdate: mocks.conflict });
  mocks.addCredits.mockReset();
  mocks.lineItems.mockReset().mockResolvedValue({
    data: [{ quantity: 1, price: { id: "price_credit50" } }],
  });
});

describe("AppForge Stripe fail-closed ownership", () => {
  it("retries an AppForge subscription event when no AppForge user can be resolved", async () => {
    mocks.retrieve.mockResolvedValue({
      id: "sub_orphan",
      customer: "cus_orphan",
      status: "active",
      metadata: { product_line: "appforge" },
      items: { data: [{ price: { id: "price_starter" } }] },
    });

    const res = await deliver("customer.subscription.created", {
      id: "sub_orphan",
    });

    expect(mocks.values).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("retries a paid AppForge credit checkout when the AppForge user identity is missing", async () => {
    const res = await deliver("checkout.session.completed", {
      id: "cs_orphan_credit",
      mode: "payment",
      payment_status: "paid",
      payment_intent: "pi_orphan_credit",
      metadata: { product_line: "appforge", credits: "50" },
    });

    expect(mocks.addCredits).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("retries an AppForge subscription checkout when the AppForge user identity is missing", async () => {
    mocks.retrieve.mockResolvedValue({
      id: "sub_checkout_orphan",
      customer: "cus_orphan",
      status: "active",
      metadata: { product_line: "appforge" },
      items: { data: [{ price: { id: "price_starter" } }] },
    });

    const res = await deliver("checkout.session.completed", {
      id: "cs_orphan_subscription",
      mode: "subscription",
      customer: "cus_orphan",
      subscription: "sub_checkout_orphan",
      metadata: { product_line: "appforge", tier: "starter" },
    });

    expect(mocks.values).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
