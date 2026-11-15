import { createHmac, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import type { Request, Response } from "express";
import { APPROVED_MONTHLY_PRICE_IDS } from "../services/appForgePricePolicy.js";

const fake = vi.hoisted(() => ({
  subscription: null as Record<string, unknown> | null,
  retrieve: vi.fn(
    async (_id: string): Promise<Record<string, unknown> | null> => null,
  ),
  lineItems: vi.fn(
    async (
      _id: string,
    ): Promise<{
      data: Array<{ quantity: number; price: { id: string } }>;
    }> => ({
      data: [],
    }),
  ),
}));

// The original Stripe SDK still verifies the exact local webhook HMAC.
// Only its network-facing transport is replaced; no Stripe endpoint is called.
vi.mock("stripe", async (importOriginal) => {
  const actual = await importOriginal<typeof import("stripe")>();
  const verifier = new actual.default("sk_test_offline_fixture", {
    apiVersion: "2024-06-20" as never,
  });
  return {
    default: class {
      webhooks = verifier.webhooks;
      subscriptions = { retrieve: fake.retrieve };
      checkout = { sessions: { listLineItems: fake.lineItems } };
      charges = { retrieve: vi.fn() };
      paymentIntents = { retrieve: vi.fn() };
    },
  };
});

vi.mock("../services/providerCreditProvisioning.js", () => ({
  grantStripeInvoiceProviderCredits: async () => ({
    grantedCents: 0,
    skipped: true,
  }),
}));
vi.mock("../services/providerCreditTopUps.js", () => ({
  fulfillProviderCreditTopUp: vi.fn(),
  expireProviderCreditTopUp: vi.fn(),
}));
vi.mock("../_core/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../lib/operationsObservability.js", () => ({
  incrementOperationalMetric: vi.fn(),
}));

const databaseUrl = process.env.APPFORGE_MANAGER_TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;

suite("real HTTP Stripe webhook handler with isolated local PostgreSQL", () => {
  const schema = `stripe_webhook_http_${randomBytes(7).toString("hex")}`;
  const secret = "whsec_local_http_contract_fixture";
  let admin: ReturnType<typeof postgres>;
  let closeDbConnection: () => Promise<void>;
  let handleStripeWebhook: typeof import("../webhooks/stripe.js").handleStripeWebhook;
  let deductCredits: typeof import("../db.js").deductCredits;
  const now = Math.floor(Date.now() / 1000);
  const start = now - 3600;
  const end = now + 30 * 86400;

  function signedPayload(type: string, id: string, object: unknown) {
    const body = Buffer.from(
      JSON.stringify({ id, object: "event", type, data: { object } }),
    );
    const timestamp = Math.floor(Date.now() / 1000);
    const hmac = createHmac("sha256", secret)
      .update(`${timestamp}.${body.toString("utf8")}`)
      .digest("hex");
    return { body, signature: `t=${timestamp},v1=${hmac}` };
  }

  async function deliver(
    type: string,
    id: string,
    object: unknown,
    bad = false,
  ) {
    const fixture = signedPayload(type, id, object);
    const response = { status: vi.fn(), json: vi.fn() };
    response.status.mockReturnValue(response);
    await handleStripeWebhook(
      {
        body: fixture.body,
        headers: { "stripe-signature": bad ? "t=1,v1=bad" : fixture.signature },
      } as unknown as Request,
      response as unknown as Response,
    );
    return response;
  }

  async function rows(query: string, params: string[] = []) {
    return admin.unsafe(query, params);
  }
  async function balance() {
    const data = await rows(
      `SELECT balance FROM "${schema}".user_credits WHERE user_id=101`,
    );
    return Number(data[0].balance);
  }
  async function grants(reference: string) {
    const data = await rows(
      `SELECT COUNT(*)::int AS count FROM "${schema}".credit_transactions WHERE stripe_payment_intent_id=$1`,
      [reference],
    );
    return Number(data[0].count);
  }
  async function status() {
    const data = await rows(
      `SELECT status,tier FROM "${schema}".subscriptions WHERE user_id=101`,
    );
    return data[0];
  }

  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (
      !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
      url.pathname !== "/appforge_manager_test"
    ) {
      throw new Error("Refusing non-disposable PostgreSQL fixture database");
    }
    admin = postgres(databaseUrl!, {
      max: 1,
      prepare: false,
      connect_timeout: 5,
    });
    await admin.unsafe(`CREATE SCHEMA "${schema}"`);
    const isolatedUrl = new URL(databaseUrl!);
    isolatedUrl.searchParams.set("search_path", schema);
    const fixture = postgres(isolatedUrl.toString(), {
      max: 1,
      prepare: false,
    });
    try {
      await fixture.unsafe(`
        CREATE TABLE users (
          id integer PRIMARY KEY,
          open_id varchar(255), email varchar(255), name varchar(255),
          picture text, is_banned boolean DEFAULT false,
          banned_at timestamp, ban_reason text,
          created_at timestamp DEFAULT NOW(), updated_at timestamp DEFAULT NOW()
        );
        CREATE TABLE subscriptions (
          id serial PRIMARY KEY, user_id integer NOT NULL UNIQUE REFERENCES users(id),
          stripe_customer_id varchar(255) UNIQUE,
          stripe_subscription_id varchar(255) UNIQUE,
          status varchar(50), tier varchar(50) DEFAULT 'free',
          aftercare_plus boolean NOT NULL DEFAULT false,
          trial_end timestamp, current_period_start timestamp,
          current_period_end timestamp,
          created_at timestamp DEFAULT NOW(), updated_at timestamp DEFAULT NOW()
        );
        CREATE TABLE user_credits (
          id serial PRIMARY KEY, user_id integer NOT NULL UNIQUE REFERENCES users(id),
          balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
          tier varchar(50) DEFAULT 'free', monthly_allowance integer DEFAULT 0,
          unlimited boolean DEFAULT false, last_refill_at timestamp DEFAULT NOW(),
          created_at timestamp DEFAULT NOW(), updated_at timestamp DEFAULT NOW()
        );
        CREATE TABLE credit_transactions (
          id serial PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id),
          amount integer NOT NULL, type varchar(50) NOT NULL,
          project_id integer, stripe_payment_intent_id varchar(255) UNIQUE,
          description text, created_at timestamp DEFAULT NOW()
        );
        CREATE TABLE projects (
          id serial PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id),
          status varchar(50) DEFAULT 'paused', pause_reason text,
          updated_at timestamp DEFAULT NOW()
        );
        CREATE TABLE stripe_webhook_events (
          event_id varchar(255) PRIMARY KEY, event_type varchar(255) NOT NULL,
          processed_at timestamp NOT NULL DEFAULT NOW()
        );
        INSERT INTO users (id,email) VALUES (101,'customer@example.test');
        INSERT INTO subscriptions
          (user_id,stripe_customer_id,stripe_subscription_id,status,tier,
           current_period_start,current_period_end)
        VALUES (101,'cus_fixture_101','sub_fixture_101','active','starter',
                NOW()-INTERVAL '1 hour',NOW()+INTERVAL '30 days');
        INSERT INTO user_credits (user_id,balance,tier,monthly_allowance)
        VALUES (101,0,'free',0);
      `);
    } finally {
      await fixture.end({ timeout: 5 });
    }
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = isolatedUrl.toString();
    process.env.STRIPE_SECRET_KEY = "sk_test_local_fixture_only";
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    process.env.STRIPE_CREDITS_50_PRICE_ID = "price_local_credit50";
    fake.retrieve.mockImplementation(async () => fake.subscription);
    fake.lineItems.mockResolvedValue({
      data: [{ quantity: 1, price: { id: "price_local_credit50" } }],
    });
    fake.subscription = {
      id: "sub_fixture_101",
      customer: "cus_fixture_101",
      status: "active",
      metadata: { product_line: "appforge", userId: "101", tier: "starter" },
      items: {
        data: [
          { price: { id: APPROVED_MONTHLY_PRICE_IDS.starter }, quantity: 1 },
        ],
      },
      current_period_start: start,
      current_period_end: end,
    };
    vi.resetModules();
    ({ handleStripeWebhook } = await import("../webhooks/stripe.js"));
    ({ closeDbConnection, deductCredits } = await import("../db.js"));
  }, 15_000);

  afterAll(async () => {
    if (closeDbConnection) await closeDbConnection();
    if (admin) {
      await admin.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.end({ timeout: 5 });
    }
  });

  it("rejects a malformed HMAC before credit mutation", async () => {
    const res = await deliver(
      "invoice.paid",
      "evt_bad_hmac",
      { id: "in_bad_hmac", subscription: "sub_fixture_101" },
      true,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(await balance()).toBe(0);
    expect(await grants("in_bad_hmac")).toBe(0);
  });

  it("grants once for concurrent paid invoice webhooks and independent replays", async () => {
    const invoice = {
      id: "in_fixture_101",
      subscription: "sub_fixture_101",
      billing_reason: "subscription_cycle",
      lines: {
        has_more: false,
        data: [
          {
            type: "subscription",
            proration: false,
            quantity: 1,
            price: { id: APPROVED_MONTHLY_PRICE_IDS.starter },
            period: { start, end },
          },
        ],
      },
    };
    const responses = await Promise.all([
      deliver("invoice.paid", "evt_invoice_101", invoice),
      deliver("invoice.paid", "evt_invoice_101", invoice),
    ]);
    for (const res of responses) {
      expect(res.json).toHaveBeenCalledWith({ received: true });
    }
    expect(await balance()).toBe(100);
    expect(await grants(invoice.id)).toBe(1);
    const replay = await deliver(
      "invoice.paid",
      "evt_invoice_101_other",
      invoice,
    );
    expect(replay.json).toHaveBeenCalledWith({ received: true });
    expect(await balance()).toBe(100);
    expect(await grants(invoice.id)).toBe(1);
  });

  it("persists purchased credits once even with two distinct events for one payment intent", async () => {
    const session = {
      id: "cs_local_101",
      mode: "payment",
      payment_status: "paid",
      payment_intent: "pi_local_101",
      client_reference_id: "101",
      metadata: { product_line: "appforge", userId: "101", credits: "50" },
    };
    const responses = await Promise.all([
      deliver("checkout.session.completed", "evt_topup_1", session),
      deliver(
        "checkout.session.async_payment_succeeded",
        "evt_topup_2",
        session,
      ),
    ]);
    for (const res of responses) {
      expect(res.json).toHaveBeenCalledWith({ received: true });
    }
    expect(await balance()).toBe(150);
    expect(await grants("pi_local_101")).toBe(1);
  });

  it("reconciles failed payment to past_due without minting credit", async () => {
    fake.subscription = { ...fake.subscription, status: "past_due" };
    const res = await deliver("invoice.payment_failed", "evt_failed_101", {
      id: "in_failed_101",
      subscription: "sub_fixture_101",
    });
    expect(res.json).toHaveBeenCalledWith({ received: true });
    expect((await status()).status).toBe("past_due");
    expect(await balance()).toBe(150);
    expect(await grants("in_failed_101")).toBe(0);
  });

  it("cancels only the matching subscription and does not issue credits", async () => {
    const res = await deliver(
      "customer.subscription.deleted",
      "evt_canceled_101",
      {
        id: "sub_fixture_101",
        customer: "cus_fixture_101",
        metadata: { product_line: "appforge", userId: "101" },
        items: {
          data: [{ price: { id: APPROVED_MONTHLY_PRICE_IDS.starter } }],
        },
      },
    );
    expect(res.json).toHaveBeenCalledWith({ received: true });
    expect(await status()).toMatchObject({ status: "canceled", tier: "free" });
    expect(await balance()).toBe(150);
  });

  it("rejects exhausted customer credit debits without a negative balance", async () => {
    expect(await deductCredits(101, 150)).toBe(0);
    await expect(deductCredits(101, 1)).rejects.toThrow(/Insufficient credits/);
    expect(await balance()).toBe(0);
  });
});
