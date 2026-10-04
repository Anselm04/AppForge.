import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import type { Request, Response } from "express";

const state = vi.hoisted(() => ({
  event: {} as {
    id: string;
    type: string;
    data: { object: Record<string, unknown> };
  },
  retrieve: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
  where: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class {
    webhooks = { constructEvent: () => state.event };
    subscriptions = { retrieve: state.retrieve };
  },
}));
vi.mock("../db.js", () => ({
  addCredits: vi.fn(),
  db: {
    query: {
      subscriptions: {
        findFirst: async () => ({
          userId: 42,
          stripeSubscriptionId: "sub_new",
        }),
      },
    },
    insert: () => ({
      values: (value: unknown) => ({
        onConflictDoUpdate: () => state.upsert(value),
      }),
    }),
    update: () => ({
      set: (value: unknown) => {
        state.update(value);
        return { where: state.where };
      },
    }),
  },
}));
vi.mock("../services/stripeEventLedger.js", () => ({
  processStripeEventOnce: async (
    _id: string,
    _type: string,
    handler: () => Promise<void>,
  ) => {
    await handler();
    return true;
  },
}));
vi.mock("../services/stripePlanCredits.js", () => ({
  grantStripeInvoicePlanCredits: vi.fn(),
}));
vi.mock("../services/stripeCreditRefund.js", () => ({
  reconcileCreditPurchaseRefund: vi.fn(),
}));

let webhook: typeof import("../webhooks/stripe.js").handleStripeWebhook;

function subscription(
  id = "sub_new",
  status = "active",
  price = "price_builder",
) {
  return {
    id,
    customer: "cus_owner",
    status,
    metadata: { userId: "42" },
    items: { data: [{ price: { id: price } }] },
    current_period_end: 1800000000,
  };
}

async function deliver(type: string, object: Record<string, unknown>) {
  state.event = { id: "evt_delayed", type, data: { object } };
  const req = {
    headers: { "stripe-signature": "signed" },
    body: "body",
  } as unknown as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  await webhook(req, res);
  return res;
}

describe("delayed Stripe subscription events", () => {
  beforeAll(async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_placeholder");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_placeholder");
    vi.stubEnv("STRIPE_BUILDER_PRICE_ID", "price_builder");
    vi.stubEnv("STRIPE_STARTER_PRICE_ID", "price_starter");
    webhook = (await import("../webhooks/stripe.js")).handleStripeWebhook;
  });

  beforeEach(() => {
    state.retrieve.mockReset().mockResolvedValue(subscription());
    state.upsert.mockReset().mockResolvedValue(undefined);
    state.update.mockReset();
    state.where.mockReset().mockResolvedValue(undefined);
  });

  it("uses Stripe's current state rather than a delayed old plan-change snapshot", async () => {
    await deliver(
      "customer.subscription.updated",
      subscription("sub_new", "past_due", "price_starter"),
    );
    expect(state.retrieve).toHaveBeenCalledWith("sub_new");
    expect(state.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: "active", tier: "builder" }),
    );
  });

  it("scopes cancellation to the canceled subscription so a new purchase survives", async () => {
    await deliver(
      "customer.subscription.deleted",
      subscription("sub_old", "canceled"),
    );
    const query = new PgDialect().sqlToQuery(
      state.where.mock.calls[0][0] as SQL,
    );
    expect(query.sql).toContain('"stripe_subscription_id"');
    expect(query.params).toContain("sub_old");
    expect(query.params).toContain(42);
  });

  it("does not mark a recovered payment past_due when a failure event arrives late", async () => {
    await deliver("invoice.payment_failed", { subscription: "sub_new" });
    expect(state.retrieve).toHaveBeenCalledWith("sub_new");
    expect(state.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "active" }),
    );
  });

  it("returns a retryable failure without mutating billing when Stripe cannot be consulted", async () => {
    state.retrieve.mockRejectedValue(new Error("Stripe unavailable"));
    const res = await deliver("customer.subscription.updated", subscription());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(state.upsert).not.toHaveBeenCalled();
  });
});
