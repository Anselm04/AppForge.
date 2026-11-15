import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import Stripe from "stripe";

const mocks = vi.hoisted(() => ({
  handled: vi.fn(),
}));

// No database socket, external Stripe request, or billable provider access.
vi.mock("../db.js", () => ({
  addCredits: vi.fn(),
  db: {},
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
  ) => {
    mocks.handled();
    await handler();
    return true;
  },
}));
vi.mock("../services/providerCreditProvisioning.js", () => ({
  grantStripeInvoiceProviderCredits: vi.fn(),
}));
vi.mock("../services/providerCreditTopUps.js", () => ({
  expireProviderCreditTopUp: vi.fn(),
  fulfillProviderCreditTopUp: vi.fn(),
}));
vi.mock("../_core/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../lib/operationsObservability.js", () => ({
  incrementOperationalMetric: vi.fn(),
}));

const secret = "whsec_local_fixture_not_a_real_key";
const payload = JSON.stringify({
  id: "evt_signature_fixture",
  object: "event",
  type: "appforge.fixture.ignored",
  data: { object: { id: "fixture" } },
});

async function deliver(signature?: string) {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret);
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_local_fixture_not_a_key");
  vi.resetModules();
  const { handleStripeWebhook } = await import("../webhooks/stripe.js");
  const response = { status: vi.fn(), json: vi.fn() };
  response.status.mockReturnValue(response);
  await handleStripeWebhook(
    {
      headers: signature ? { "stripe-signature": signature } : {},
      body: Buffer.from(payload, "utf8"),
    } as unknown as Request,
    response as unknown as Response,
  );
  return response;
}

describe("real Stripe SDK webhook signature verification without network", () => {
  beforeEach(() => mocks.handled.mockReset());

  it("rejects missing signature without calling the event ledger", async () => {
    const res = await deliver();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.handled).not.toHaveBeenCalled();
  });

  it("rejects a tampered signature before processing credits", async () => {
    const res = await deliver("t=123,v1=invalid");
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.handled).not.toHaveBeenCalled();
  });

  it("accepts an authentic local test signature without contacting Stripe", async () => {
    const stripe = new Stripe("sk_test_local_fixture_not_a_key", {
      apiVersion: "2024-06-20" as never,
    });
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret,
    });
    const res = await deliver(signature);
    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ received: true });
    expect(mocks.handled).toHaveBeenCalledTimes(1);
  });
});
