import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { before, after, test } from "node:test";
import postgres from "postgres";
import Stripe from "stripe";

/**
 * Disposable PostgreSQL contract test. No network except 127.0.0.1:5432,
 * no Stripe API calls and no real credentials.
 * This qualifies signed-event -> event-ledger -> invoice grant -> persisted
 * balance, not the full HTTP webhook router or provider charge settlement.
 */
const testUrl = process.env.APPFORGE_MANAGER_TEST_DATABASE_URL;
if (!testUrl) throw new Error("Local PostgreSQL test URL required");
const parsed = new URL(testUrl);
if (
  !["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname) ||
  parsed.pathname !== "/appforge_manager_test"
) {
  throw new Error("Refusing non-disposable database");
}
const schema = `stripe_persistence_${randomBytes(7).toString("hex")}`;
const admin = postgres(testUrl, { max: 1, prepare: false, connect_timeout: 5 });
const fixtureUrl = new URL(testUrl);
fixtureUrl.searchParams.set("search_path", schema);
const stripe = new Stripe("sk_test_offline_fixture_only", {
  apiVersion: "2024-06-20" as never,
});
const webhookSecret = "whsec_offline_fixture_only";
let closeDbConnection: () => Promise<void>;
let grant: typeof import("../src/services/stripePlanCredits.js").grantStripeInvoicePlanCredits;
let processOnce: typeof import("../src/services/stripeEventLedger.js").processStripeEventOnce;
let deductCredits: typeof import("../src/db.js").deductCredits;
let addCredits: typeof import("../src/db.js").addCredits;
let assertEligibleForCreditTopUp: typeof import("../src/services/appForgeCreditEligibility.js").assertEligibleForCreditTopUp;

async function balance() {
  const rows = await admin.unsafe(
    `SELECT balance FROM "${schema}".user_credits WHERE user_id = 101`,
  );
  return Number(rows[0].balance);
}
async function transactionCount(id: string) {
  const rows = await admin.unsafe(
    `SELECT count(*)::int AS total FROM "${schema}".credit_transactions WHERE stripe_payment_intent_id = $1`,
    [id],
  );
  return Number(rows[0].total);
}
function signedFixture(eventId: string, type: string, invoiceId: string) {
  const payload = JSON.stringify({
    id: eventId,
    object: "event",
    type,
    data: { object: { id: invoiceId, billing_reason: "subscription_cycle" } },
  });
  return {
    payload,
    signature: stripe.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
    }),
  };
}
async function receiveSignedInvoice(
  eventId: string,
  invoiceId: string,
  signatureOverride?: string,
) {
  const fixture = signedFixture(eventId, "invoice.paid", invoiceId);
  const event = stripe.webhooks.constructEvent(
    Buffer.from(fixture.payload),
    signatureOverride ?? fixture.signature,
    webhookSecret,
  );
  assert.equal(event.type, "invoice.paid");
  const invoice = event.data.object as Stripe.Invoice;
  return processOnce(event.id, event.type, async () => {
    await grant(101, "starter", invoice.id, "starter");
  });
}

before(async () => {
  await admin.unsafe(`CREATE SCHEMA "${schema}"`);
  const db = postgres(fixtureUrl.toString(), { max: 1, prepare: false });
  try {
    await db.unsafe(`
      CREATE TABLE users (
        id integer PRIMARY KEY,
        email varchar(255),
        open_id varchar(255),
        name varchar(255),
        picture text,
        is_banned boolean DEFAULT false,
        banned_at timestamp,
        ban_reason text,
        created_at timestamp DEFAULT NOW(),
        updated_at timestamp DEFAULT NOW()
      );
      CREATE TABLE user_credits (
        id serial PRIMARY KEY,
        user_id integer NOT NULL UNIQUE REFERENCES users(id),
        balance integer NOT NULL DEFAULT 0 CHECK(balance >= 0),
        tier varchar(50) DEFAULT 'free',
        monthly_allowance integer DEFAULT 0,
        unlimited boolean DEFAULT false,
        last_refill_at timestamp DEFAULT NOW(),
        created_at timestamp DEFAULT NOW(),
        updated_at timestamp DEFAULT NOW()
      );
      CREATE TABLE credit_transactions (
        id serial PRIMARY KEY,
        user_id integer NOT NULL REFERENCES users(id),
        amount integer NOT NULL,
        type varchar(50) NOT NULL,
        project_id integer,
        stripe_payment_intent_id varchar(255) UNIQUE,
        description text,
        created_at timestamp DEFAULT NOW()
      );
      CREATE TABLE projects (
        id serial PRIMARY KEY,
        user_id integer NOT NULL REFERENCES users(id),
        status varchar(50) DEFAULT 'pending',
        pause_reason text,
        updated_at timestamp DEFAULT NOW()
      );
      CREATE TABLE stripe_webhook_events (
        event_id varchar(255) PRIMARY KEY,
        event_type varchar(255) NOT NULL,
        processed_at timestamp NOT NULL DEFAULT NOW()
      );
      INSERT INTO users (id, email)
      VALUES (101, 'fixture-user@example.test');
      INSERT INTO user_credits (user_id, balance, tier, monthly_allowance)
      VALUES (101, 0, 'free', 0);
    `);
  } finally {
    await db.end({ timeout: 5 });
  }
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = fixtureUrl.toString();
  ({ closeDbConnection, deductCredits, addCredits } = await import("../src/db.js"));
  ({ grantStripeInvoicePlanCredits: grant } = await import("../src/services/stripePlanCredits.js"));
  ({ processStripeEventOnce: processOnce } = await import("../src/services/stripeEventLedger.js"));
  ({ assertEligibleForCreditTopUp } = await import("../src/services/appForgeCreditEligibility.js"));
});
after(async () => {
  if (closeDbConnection) await closeDbConnection();
  await admin.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await admin.end({ timeout: 5 });
});

test("bad Stripe HMAC never reaches persisted invoice fulfillment", async () => {
  const fixture = signedFixture("evt_invalid_101", "invoice.paid", "in_invalid_101");
  assert.throws(
    () => stripe.webhooks.constructEvent(Buffer.from(fixture.payload), "t=1,v1=wrong", webhookSecret),
    /signature|timestamp/i,
  );
  assert.equal(await balance(), 0);
  assert.equal(await transactionCount("in_invalid_101"), 0);
});

test("two simultaneous signed invoice deliveries credit PostgreSQL exactly once", async () => {
  assert.deepEqual(
    (await Promise.all([
      receiveSignedInvoice("evt_paid_101", "in_paid_101"),
      receiveSignedInvoice("evt_paid_101", "in_paid_101"),
    ])).sort(),
    [false, true],
  );
  assert.equal(await balance(), 100);
  assert.equal(await transactionCount("in_paid_101"), 1);
  // Different Stripe event identity with the *same invoice* also cannot mint twice.
  assert.equal(await receiveSignedInvoice("evt_paid_101_replay", "in_paid_101"), true);
  assert.equal(await balance(), 100);
  assert.equal(await transactionCount("in_paid_101"), 1);
});

test("credit debit is persisted and refuses exhaustion without writing a ledger entry", async () => {
  assert.equal(await deductCredits(101, 40), 60);
  assert.equal(await balance(), 60);
  await assert.rejects(deductCredits(101, 61), /Insufficient credits/);
  assert.equal(await balance(), 60);
  assert.equal(await transactionCount("in_paid_101"), 1);
});

test("payment intent top-up across duplicate events is recorded once", async () => {
  const [first, second] = await Promise.all([
    addCredits(101, 50, "purchase", "local paid checkout", "pi_local_101"),
    addCredits(101, 50, "purchase", "local paid checkout", "pi_local_101"),
  ]);
  assert.equal(first, 110);
  assert.equal(second, 110);
  assert.equal(await balance(), 110);
  assert.equal(await transactionCount("pi_local_101"), 1);
});

test("failed and cancelled entitlement states cannot initiate top-up", () => {
  for (const status of ["past_due", "unpaid", "canceled"]) {
    assert.throws(
      () => assertEligibleForCreditTopUp({ status, tier: "starter" }),
      /active paid AppForge subscription/,
    );
  }
  // No synthetic payment-failed event was translated into a paid invoice.
  // Consequently these cases have not minted extra credit.
});


async function creditEntitlement() {
  const rows = await admin.unsafe(
    `SELECT tier, monthly_allowance, balance FROM "${schema}".user_credits WHERE user_id = 101`,
  );
  return {
    tier: String(rows[0].tier),
    monthlyAllowance: Number(rows[0].monthly_allowance),
    balance: Number(rows[0].balance),
  };
}

test("paid invoice changes persist plan-specific entitlements across upgrade and downgrade", async () => {
  // Distinct locally simulated paid invoices; the settlement handler is real.
  // This tests invoice grant + cached credit tier, not external plan mutation.
  const builder = await grant(101, "builder", "in_builder_upgrade_101");
  assert.deepEqual(builder, { granted: 400, skipped: false });
  assert.deepEqual(await creditEntitlement(), {
    tier: "builder", monthlyAllowance: 66, balance: 510,
  });
  assert.deepEqual(await grant(101, "builder", "in_builder_upgrade_101"), {
    granted: 0, skipped: true,
  });
  const studio = await grant(101, "studio", "in_studio_upgrade_101");
  assert.deepEqual(studio, { granted: 1500, skipped: false });
  assert.deepEqual(await creditEntitlement(), {
    tier: "studio", monthlyAllowance: 0, balance: 2010,
  });
  const starter = await grant(101, "starter", "in_starter_downgrade_101");
  assert.deepEqual(starter, { granted: 100, skipped: false });
  assert.deepEqual(await creditEntitlement(), {
    tier: "starter", monthlyAllowance: 16, balance: 2110,
  });
  for (const id of [
    "in_builder_upgrade_101",
    "in_studio_upgrade_101",
    "in_starter_downgrade_101",
  ]) {
    assert.equal(await transactionCount(id), 1);
  }
});

test("unrecognized or free invoice cannot mint a paid credit entitlement", async () => {
  const original = await creditEntitlement();
  const unknown = await grant(101, "free", "in_free_no_paid_grant_101");
  assert.deepEqual(unknown, { granted: 0, skipped: false });
  assert.equal(await balance(), original.balance);
  assert.equal(await transactionCount("in_free_no_paid_grant_101"), 1);
  // Real webhook ownership/tier validation is exercised separately.
});
