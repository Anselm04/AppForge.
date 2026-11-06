import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, test } from "node:test";
import postgres from "postgres";

const testUrl = process.env.APPFORGE_MANAGER_TEST_DATABASE_URL;
if (!testUrl) {
  throw new Error("APPFORGE_MANAGER_TEST_DATABASE_URL is required");
}
const url = new URL(testUrl);
if (
  !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
  url.pathname !== "/appforge_manager_test"
) {
  throw new Error(
    "Provider ledger test requires the local disposable test database",
  );
}

const schema = `provider_spend_test_${randomBytes(8).toString("hex")}`;
const admin = postgres(testUrl, { max: 1, prepare: false, connect_timeout: 5 });
let closeDbConnection: () => Promise<void>;
let reserveProviderSpend: typeof import("../src/services/providerSpendLedger.js").reserveProviderSpend;
let releaseProviderSpend: typeof import("../src/services/providerSpendLedger.js").releaseProviderSpend;
let settleProviderSpend: typeof import("../src/services/providerSpendLedger.js").settleProviderSpend;
let withBuildExecutionLease: typeof import("../src/services/buildExecutionLease.js").withBuildExecutionLease;
let runReservedProviderOperation: typeof import("../src/services/guardedProviderOperation.js").runReservedProviderOperation;
let grantStripeInvoiceProviderCredits: typeof import("../src/services/providerCreditProvisioning.js").grantStripeInvoiceProviderCredits;

before(async () => {
  await admin.unsafe(`CREATE SCHEMA "${schema}"`);
  const isolated = new URL(testUrl);
  isolated.searchParams.set("search_path", schema);
  process.env.DATABASE_URL = isolated.toString();
  const {
    PROVIDER_SPEND_LEDGER_SQL,
    PROVIDER_SPEND_SAFETY_SQL,
    PROVIDER_CREDIT_ACCOUNTS_SQL,
    PROVIDER_CREDIT_INVOICE_PERIOD_SQL,
  } = await import("../src/db/ensureSchema.js");
  await admin.unsafe(`
    CREATE TABLE "${schema}".users (id integer PRIMARY KEY);
    CREATE TABLE "${schema}".projects (
      id integer PRIMARY KEY, user_id integer REFERENCES "${schema}".users(id),
      status text NOT NULL DEFAULT 'running'
    );
    CREATE TABLE "${schema}".subscriptions (
      user_id integer PRIMARY KEY REFERENCES "${schema}".users(id),
      tier text, status text, current_period_start timestamp,
      current_period_end timestamp, trial_end timestamp
    );
    CREATE TABLE "${schema}".build_events (
      id serial PRIMARY KEY, project_id integer NOT NULL REFERENCES "${schema}".projects(id),
      event varchar(50) NOT NULL, payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamp DEFAULT NOW()
    );
  `);
  const fixture = postgres(isolated.toString(), { max: 1, prepare: false });
  try {
    await fixture.unsafe(PROVIDER_SPEND_LEDGER_SQL);
    await fixture.unsafe(PROVIDER_SPEND_SAFETY_SQL);
    await fixture.unsafe(PROVIDER_CREDIT_ACCOUNTS_SQL);
    await fixture.unsafe(PROVIDER_CREDIT_INVOICE_PERIOD_SQL);
    await fixture.unsafe(`
      INSERT INTO users (id) VALUES (1), (2);
      INSERT INTO projects (id, user_id) VALUES (10, 1), (20, 2);
      INSERT INTO build_events (id, project_id, event, payload)
      VALUES (22, 10, 'build_execution_claim', '{}'::jsonb),
             (23, 10, 'build_execution_claim', '{}'::jsonb),
             (24, 20, 'build_execution_claim', '{}'::jsonb);
      INSERT INTO subscriptions
        (user_id, tier, status, current_period_start, current_period_end)
      VALUES (1, 'starter', 'active', NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 day'),
             (2, 'starter', 'active', NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 day');
      INSERT INTO provider_credit_accounts
        (user_id, purchased_balance_cents)
      SELECT user_id, 0 FROM subscriptions;
      INSERT INTO provider_credit_periods
        (user_id, period_start, period_end,
         included_balance_cents, included_allowance_cents)
      SELECT user_id, current_period_start::date, current_period_end,
        1200, 1200 FROM subscriptions;
    `);
  } finally {
    await fixture.end({ timeout: 5 });
  }
  ({ closeDbConnection } = await import("../src/db.js"));
  ({ reserveProviderSpend, releaseProviderSpend, settleProviderSpend } =
    await import("../src/services/providerSpendLedger.js"));
  ({ grantStripeInvoiceProviderCredits } =
    await import("../src/services/providerCreditProvisioning.js"));
  ({ withBuildExecutionLease } =
    await import("../src/services/buildExecutionLease.js"));
  process.env.NODE_ENV = "test";
  ({ runReservedProviderOperation } =
    await import("../src/services/guardedProviderOperation.js"));
});

after(async () => {
  if (closeDbConnection) await closeDbConnection();
  await admin.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await admin.end({ timeout: 5 });
});

test("real PostgreSQL enforces concurrent billing-period and per-build limits", async () => {
  const input = {
    userId: 1,
    projectId: 10,
    executionId: 22,
    maximumCents: 250,
  };
  const outcomes = await Promise.allSettled([
    reserveProviderSpend({ ...input, operationId: "attempt_001" }),
    reserveProviderSpend({ ...input, operationId: "attempt_002" }),
  ]);
  assert.equal(
    outcomes.filter((result) => result.status === "fulfilled").length,
    1,
  );
  const rejected = outcomes.find((result) => result.status === "rejected");
  assert.ok(rejected && rejected.status === "rejected");
  assert.match(String(rejected.reason), /Provider per-build budget exhausted/);
  const rows = await admin.unsafe(
    `SELECT operation_id, maximum_cents, state FROM "${schema}".provider_spend_reservations WHERE user_id = 1`,
  );
  assert.equal(rows.length, 1);
  assert.equal(Number(rows[0].maximum_cents), 250);
  assert.equal(rows[0].state, "reserved");
  await assert.rejects(
    reserveProviderSpend({
      ...input,
      operationId: "attempt_003",
      maximumCents: 51,
    }),
    /Provider per-build budget exhausted/,
  );
  await settleProviderSpend(1, String(rows[0].operation_id), 200);
  const balanceAfterPartialSettlement = await admin.unsafe(
    `SELECT included_balance_cents FROM "${schema}".provider_credit_periods WHERE user_id = 1`,
  );
  assert.equal(
    Number(balanceAfterPartialSettlement[0].included_balance_cents),
    1000,
  );
  assert.equal(
    await reserveProviderSpend({
      ...input,
      operationId: "attempt_004",
      maximumCents: 100,
    }),
    "reserved",
  );
  await settleProviderSpend(1, "attempt_004", 100);
  await assert.rejects(
    reserveProviderSpend({
      ...input,
      operationId: "attempt_005",
      maximumCents: 1,
    }),
    /Provider per-build budget exhausted/,
  );
  const settled = await admin.unsafe(
    `SELECT state, maximum_cents, actual_cents FROM "${schema}".provider_spend_reservations WHERE user_id = 1 AND state = 'settled'`,
  );
  assert.equal(settled[0].state, "settled");
  assert.equal(Number(settled[0].maximum_cents), 250);
  assert.equal(Number(settled[0].actual_cents), 200);
  const balanceAfterSecondSettlement = await admin.unsafe(
    `SELECT included_balance_cents FROM "${schema}".provider_credit_periods WHERE user_id = 1`,
  );
  assert.equal(
    Number(balanceAfterSecondSettlement[0].included_balance_cents),
    900,
  );
});

test("Stripe invoice allowance provisioning is period-scoped and idempotent", async () => {
  const start = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60;
  const end = start + 30 * 24 * 60 * 60;
  const input = [1, "starter", "in_providergrant001", start, end] as const;
  const results = await Promise.all([
    grantStripeInvoiceProviderCredits(...input),
    grantStripeInvoiceProviderCredits(...input),
  ]);
  assert.equal(results.filter((result) => !result.skipped).length, 1);
  assert.equal(results.filter((result) => result.skipped).length, 1);
  assert.deepEqual(await grantStripeInvoiceProviderCredits(...input), {
    grantedCents: 0,
    skipped: true,
  });
  const period = new Date(start * 1000).toISOString().slice(0, 10);
  const rows = await admin.unsafe(
    `SELECT included_balance_cents, included_allowance_cents, grant_invoice_id
      FROM "${schema}".provider_credit_periods
      WHERE user_id = 1 AND period_start = $1::date`,
    [period],
  );
  assert.equal(rows.length, 1);
  assert.equal(Number(rows[0].included_balance_cents), 1200);
  assert.equal(Number(rows[0].included_allowance_cents), 1200);
  assert.equal(rows[0].grant_invoice_id, "in_providergrant001");
  const events = await admin.unsafe(
    `SELECT COUNT(*)::int AS count FROM "${schema}".provider_credit_events
      WHERE user_id = 1 AND source_id = 'in_providergrant001'`,
  );
  assert.equal(events[0].count, 1);
  await assert.rejects(
    grantStripeInvoiceProviderCredits(
      1,
      "starter",
      "in_providergrant002",
      start,
      end,
    ),
    /conflicts with an existing invoice grant/,
  );
  await assert.rejects(
    grantStripeInvoiceProviderCredits(
      1,
      "starter",
      "in_providergrant001",
      start,
      end + 1,
    ),
    /conflicts with an existing invoice grant/,
  );
  await assert.rejects(
    grantStripeInvoiceProviderCredits(
      1,
      "starter",
      "in_providergrant003",
      end,
      start,
    ),
    /Invalid Stripe invoice billing period/,
  );
});

test("real PostgreSQL rejects cross-customer project reservations", async () => {
  await assert.rejects(
    reserveProviderSpend({
      userId: 2,
      projectId: 10,
      executionId: 22,
      operationId: "cross_tenant_001",
      maximumCents: 1,
    }),
    /Project ownership mismatch/,
  );
});

test("real PostgreSQL preserves operation idempotency and pauses past-due accounts", async () => {
  const input = {
    userId: 2,
    projectId: 20,
    executionId: 24,
    operationId: "idempotent_001",
    maximumCents: 50,
  };
  assert.equal(await reserveProviderSpend(input), "reserved");
  assert.equal(await reserveProviderSpend(input), "duplicate");
  await assert.rejects(
    reserveProviderSpend({ ...input, maximumCents: 51 }),
    /Conflicting or released/,
  );
  const count = await admin.unsafe(
    `SELECT COUNT(*)::int AS count FROM "${schema}".provider_spend_reservations WHERE user_id = 2 AND operation_id = 'idempotent_001'`,
  );
  assert.equal(count[0].count, 1);
  await releaseProviderSpend(2, input.operationId);
  const released = await admin.unsafe(
    `SELECT state FROM "${schema}".provider_spend_reservations WHERE user_id = 2 AND operation_id = 'idempotent_001'`,
  );
  assert.equal(released[0].state, "released");
  assert.equal(
    await reserveProviderSpend({
      ...input,
      operationId: "after_release_001",
      maximumCents: 300,
    }),
    "reserved",
  );
  await admin.unsafe(
    `UPDATE "${schema}".subscriptions SET status = 'past_due' WHERE user_id = 2`,
  );
  await assert.rejects(
    reserveProviderSpend({ ...input, operationId: "grace_period_001" }),
    /Active approved-tier subscription required/,
  );
});

test("PostgreSQL blocks exhausted included and purchased provider credits", async () => {
  await admin.unsafe(`
    UPDATE "${schema}".subscriptions SET status = 'active' WHERE user_id = 2;
    DELETE FROM "${schema}".provider_spend_reservations WHERE user_id = 2;
    UPDATE "${schema}".provider_credit_periods
      SET included_balance_cents = 1200 WHERE user_id = 2;
    UPDATE "${schema}".provider_credit_accounts
      SET purchased_balance_cents = 0 WHERE user_id = 2;
    INSERT INTO "${schema}".build_events (id, project_id, event, payload)
    VALUES (25, 20, 'build_execution_claim', '{}'::jsonb),
           (26, 20, 'build_execution_claim', '{}'::jsonb),
           (27, 20, 'build_execution_claim', '{}'::jsonb),
           (28, 20, 'build_execution_claim', '{}'::jsonb),
           (29, 20, 'build_execution_claim', '{}'::jsonb),
           (30, 20, 'build_execution_claim', '{}'::jsonb),
           (31, 20, 'build_execution_claim', '{}'::jsonb);
  `);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const operationId = `included_credit_${attempt}`;
    await reserveProviderSpend({
      userId: 2,
      projectId: 20,
      executionId: 25 + attempt,
      operationId,
      maximumCents: 300,
    });
    await settleProviderSpend(2, operationId, 300);
  }
  const included = await admin.unsafe(
    `SELECT included_balance_cents FROM "${schema}".provider_credit_periods WHERE user_id = 2`,
  );
  assert.equal(Number(included[0].included_balance_cents), 0);
  await assert.rejects(
    reserveProviderSpend({
      userId: 2,
      projectId: 20,
      executionId: 29,
      operationId: "included_credit_exhausted",
      maximumCents: 1,
    }),
    /credits exhausted/,
  );

  await admin.unsafe(
    `UPDATE "${schema}".provider_credit_accounts SET purchased_balance_cents = 100 WHERE user_id = 2`,
  );
  await reserveProviderSpend({
    userId: 2,
    projectId: 20,
    executionId: 30,
    operationId: "purchased_credit_001",
    maximumCents: 100,
  });
  await settleProviderSpend(2, "purchased_credit_001", 100);
  const purchased = await admin.unsafe(
    `SELECT purchased_balance_cents FROM "${schema}".provider_credit_accounts WHERE user_id = 2`,
  );
  assert.equal(Number(purchased[0].purchased_balance_cents), 0);
  await assert.rejects(
    reserveProviderSpend({
      userId: 2,
      projectId: 20,
      executionId: 31,
      operationId: "purchased_credit_exhausted",
      maximumCents: 1,
    }),
    /credits exhausted/,
  );
});

test("PostgreSQL preserves overcharges and freezes later customer reservations", async () => {
  const input = {
    userId: 1,
    projectId: 10,
    executionId: 23,
    operationId: "overrun_001",
    maximumCents: 50,
  };
  await reserveProviderSpend(input);
  await assert.rejects(
    settleProviderSpend(1, input.operationId, 75),
    /exceeded its reservation/,
  );
  const rows = await admin.unsafe(
    `SELECT state, maximum_cents, actual_cents, overrun FROM "${schema}".provider_spend_reservations WHERE operation_id = 'overrun_001'`,
  );
  assert.equal(rows[0].state, "settled");
  assert.equal(Number(rows[0].maximum_cents), 50);
  assert.equal(Number(rows[0].actual_cents), 75);
  assert.equal(rows[0].overrun, true);
  await assert.rejects(
    reserveProviderSpend({ ...input, operationId: "after_overrun_1" }),
    /frozen pending overrun reconciliation/,
  );
});

test("caller-asserted provider prices are blocked before the provider callback", async () => {
  await admin.unsafe(`
    UPDATE "${schema}".subscriptions SET status = 'active' WHERE user_id = 2;
    DELETE FROM "${schema}".provider_spend_reservations WHERE user_id = 2;
    UPDATE "${schema}".provider_credit_periods
      SET included_balance_cents = 1200 WHERE user_id = 2;
    UPDATE "${schema}".provider_credit_accounts
      SET purchased_balance_cents = 0 WHERE user_id = 2;
  `);
  await admin.unsafe(
    `DELETE FROM "${schema}".build_events WHERE project_id = 20`,
  );
  let dispatches = 0;
  await withBuildExecutionLease(
    {
      projectId: 20,
      userId: 2,
      createdAt: new Date().toISOString(),
    },
    async () => {
      await assert.rejects(
        runReservedProviderOperation(
          {
            operationId: "blocked_provider_call_001",
            envelope: {
              attempts: [
                {
                  provider: "test-provider",
                  model: "test-model",
                  maxInputTokens: 2_000_000,
                  maxOutputTokens: 2_000_000,
                  inputUsdMicrosPerMillionTokens: 1_000_000,
                  outputUsdMicrosPerMillionTokens: 1_000_000,
                  fixedRequestCents: 0,
                },
              ],
              externalRuntimeStorageEgressCents: 0,
              priceSnapshotValidUntil: new Date(
                Date.now() + 60_000,
              ).toISOString(),
              priceSnapshotSource: "provider_confirmed",
            },
          },
          async () => {
            dispatches += 1;
            return { value: "unexpected", verifiedCents: 1 };
          },
        ),
        /Trusted provider price catalogue is not configured/,
      );
    },
  );
  assert.equal(dispatches, 0);
});
