import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  subscription: null as null | {
    status: string;
    tier: string;
    stripeSubscriptionId?: string;
    stripeCustomerId?: string;
  },
  calls: [] as Array<Record<string, unknown>>,
  price: {
    id: "price_test",
    active: true,
    currency: "usd",
    unit_amount: 7900,
    type: "recurring",
    recurring: { interval: "month", interval_count: 1 },
    livemode: false,
  },
}));

vi.mock("../db.js", () => ({
  getSubscriptionByUserId: async () => mocks.subscription,
}));
vi.mock("../services/appForgeStripe.js", () => ({
  getAppForgeStripe: async () => ({
    prices: {
      retrieve: async (id: string) => ({ ...mocks.price, id }),
    },
    checkout: {
      sessions: {
        create: async (request: Record<string, unknown>) => {
          mocks.calls.push(request);
          return { url: "https://checkout.stripe.test/fake" };
        },
      },
    },
  }),
}));

import {
  createCreditCheckout,
  createPlanCheckout,
} from "../services/stripeCheckout.js";

describe("AppForge Stripe checkout: locally mocked payment transport", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PUBLIC_APP_URL", "http://localhost:5173");
    mocks.subscription = null;
    mocks.calls.length = 0;
    mocks.price = {
      id: "price_test",
      active: true,
      currency: "usd",
      unit_amount: 7900,
      type: "recurring",
      recurring: { interval: "month", interval_count: 1 },
      livemode: false,
    };
  });

  it("creates a safe plan checkout without calling Stripe's network", async () => {
    const result = await createPlanCheckout(
      { id: 42, email: "fixture@example.test" },
      "starter",
    );
    expect(result.url).toContain("stripe.test");
    expect(mocks.calls).toHaveLength(1);
    expect(mocks.calls[0]).toMatchObject({
      mode: "subscription",
      client_reference_id: "42",
      automatic_tax: { enabled: true },
      metadata: { userId: "42", tier: "starter", credits: "0" },
    });
  });

  it("rejects a price mismatch before payment session creation", async () => {
    mocks.price.unit_amount = 1;
    await expect(
      createPlanCheckout({ id: 42 }, "starter"),
    ).rejects.toThrow(/does not match/);
    expect(mocks.calls).toHaveLength(0);
  });

  it("blocks duplicate subscription checkouts", async () => {
    mocks.subscription = {
      status: "active",
      tier: "starter",
      stripeSubscriptionId: "sub_existing",
    };
    await expect(
      createPlanCheckout({ id: 42 }, "starter"),
    ).rejects.toThrow(/existing Stripe subscription/);
    expect(mocks.calls).toHaveLength(0);
  });

  it("blocks top-up checkout when the paid entitlement has been cancelled", async () => {
    mocks.subscription = { status: "canceled", tier: "starter" };
    await expect(createCreditCheckout({ id: 42 }, 50)).rejects.toThrow(
      /active paid AppForge subscription/,
    );
    expect(mocks.calls).toHaveLength(0);
  });
});
