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
let settleProviderSpend: typeof import("../src/services/providerSpendLedger.js").settleProviderSpend;

before(async () => {
  await admin.unsafe(`CREATE SCHEMA "${schema}"`);
  const isolated = new URL(testUrl);
  isolated.searchParams.set("search_path", schema);
  process.env.DATABASE_URL = isolated.toString();
  const { PROVIDER_SPEND_LEDGER_SQL } =
    await import("../src/db/ensureSchema.js");
  await admin.unsafe(`
    CREATE TABLE "${schema}".users (id integer PRIMARY KEY);
    CREATE TABLE "${schema}".projects (
      id integer PRIMARY KEY, user_id integer REFERENCES "${schema}".users(id)
    );
    CREATE TABLE "${schema}".subscriptions (
      user_id integer PRIMARY KEY REFERENCES "${schema}".users(id),
      tier text, status text, current_period_end timestamptz, trial_end timestamptz
    );
  `);
  const fixture = postgres(isolated.toString(), { max: 1, prepare: false });
  try {
    await fixture.unsafe(PROVIDER_SPEND_LEDGER_SQL);
    await fixture.unsafe(`
      INSERT INTO users (id) VALUES (1), (2);
      INSERT INTO projects (id, user_id) VALUES (10, 1), (20, 2);
      INSERT INTO subscriptions (user_id, tier, status, current_period_end)
      VALUES (1, 'starter', 'active', NOW() + INTERVAL '1 day'),
             (2, 'starter', 'active', NOW() + INTERVAL '1 day');
    `);
  } finally {
    await fixture.end({ timeout: 5 });
  }
  ({ closeDbConnection } = await import("../src/db.js"));
  ({ reserveProviderSpend, settleProviderSpend } =
    await import("../src/services/providerSpendLedger.js"));
});

after(async () => {
  if (closeDbConnection) await closeDbConnection();
  await admin.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await admin.end({ timeout: 5 });
});

test("real PostgreSQL serializes reservations and refuses overspending", async () => {
  const input = {
    userId: 1,
    projectId: 10,
    executionId: 22,
    maximumCents: 700,
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
  assert.match(String(rejected.reason), /Provider budget exhausted/);
  const rows = await admin.unsafe(
    `SELECT operation_id, maximum_cents, state FROM "${schema}".provider_spend_reservations WHERE user_id = 1`,
  );
  assert.equal(rows.length, 1);
  assert.equal(Number(rows[0].maximum_cents), 700);
  assert.equal(rows[0].state, "reserved");
  await assert.rejects(
    reserveProviderSpend({
      ...input,
      operationId: "attempt_003",
      maximumCents: 501,
    }),
    /Provider budget exhausted/,
  );
  await settleProviderSpend(1, String(rows[0].operation_id), 500);
  assert.equal(
    await reserveProviderSpend({ ...input, operationId: "attempt_004" }),
    "reserved",
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
