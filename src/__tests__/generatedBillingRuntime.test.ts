// Executes emitted product code. Stripe identities/events and auth responses are isolated TEST FIXTURES.
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  symlinkSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import express from "express";
import type { Server } from "node:http";
import postgres from "postgres";
import Stripe from "stripe";
import { billingScaffoldFiles } from "../services/saasBillingScaffold.js";
const directories: string[] = [];
function product() {
  const dir = mkdtempSync(path.join(tmpdir(), "appforge-emitted-billing-"));
  directories.push(dir);
  writeFileSync(path.join(dir, "package.json"), '{"type":"commonjs"}');
  symlinkSync(
    path.join(process.cwd(), "node_modules"),
    path.join(dir, "node_modules"),
    "dir",
  );
  const files = billingScaffoldFiles("react-node");
  for (const [name, source] of Object.entries(files)) {
    if (!name.endsWith(".ts")) continue;
    const target = path.join(dir, name.replace(/\.ts$/, ".js"));
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(
      target,
      ts.transpileModule(source, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.CommonJS,
          esModuleInterop: true,
        },
      }).outputText,
    );
  }
  return { dir, files, load: createRequire(path.join(dir, "package.json")) };
}
afterAll(() => {
  for (const dir of directories) rmSync(dir, { recursive: true, force: true });
});
describe("emitted paid product module wiring", () => {
  it("loads all emitted Express billing routes through their actual relative imports", () => {
    const p = product();
    for (const route of ["checkout", "webhook", "me", "portal", "health"])
      expect(
        p.load(path.join(p.dir, `src/server/routes/billing/${route}.js`)),
      ).toBeTruthy();
  });
});
const testUrl = process.env.APPFORGE_MANAGER_TEST_DATABASE_URL;
if (testUrl) {
  const u = new URL(testUrl);
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(u.hostname) ||
    u.pathname !== "/appforge_manager_test"
  )
    throw Error(
      "Generated billing runtime requires a local disposable test database",
    );
}
describe.runIf(Boolean(testUrl))(
  "emitted paid product lifecycle on PostgreSQL",
  () => {
    let p: ReturnType<typeof product>,
      db: postgres.Sql,
      server: Server,
      base: string,
      originalFetch: typeof fetch;
    let restoreNativeFetch = () => {};
    const stripe = new Stripe("sk_test_FIXTURE");
    const secret = "whsec_ISOLATED_FIXTURE";
    beforeAll(async () => {
      vi.stubEnv("DATABASE_URL", testUrl!);
      vi.stubEnv("SUPABASE_URL", "https://auth.example.test");
      vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "fixture-public");
      vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_FIXTURE");
      vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret);
      vi.stubEnv("STRIPE_PRICE_ID", "price_FIXTURE");
      p = product();
      db = postgres(testUrl!, { max: 1, prepare: false });
      await db.unsafe(p.files["database/billing-schema.sql"]);
      await db.unsafe(
        "TRUNCATE billing_events,billing_audit,billing_invoices,subscriptions",
      );
      originalFetch =
        (globalThis as typeof globalThis & { __originalFetch?: typeof fetch })
          .__originalFetch || globalThis.fetch;
      const webhook = p.load(
        path.join(p.dir, "src/server/routes/billing/webhook.js"),
      ).stripeWebhook;
      const me = p.load(
        path.join(p.dir, "src/server/routes/billing/me.js"),
      ).getBillingMe;
      const app = express();
      app.post(
        "/webhook",
        express.raw({ type: "application/json" }),
        (req, res, next) => {
          void Promise.resolve(webhook(req, res)).catch(next);
        },
      );
      app.get("/me", (req, res, next) => {
        void Promise.resolve(me(req, res)).catch(next);
      });
      server = app.listen(0, "127.0.0.1");
      await new Promise<void>((r) => server.on("listening", r));
      base = `http://127.0.0.1:${(server.address() as any).port}`;
    });
    beforeEach(() => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: any, init: any) =>
          String(url).startsWith("https://auth.example.test/")
            ? new Response(
                JSON.stringify({
                  id:
                    init.headers.authorization === "Bearer fixture-buyer"
                      ? "fixture-buyer"
                      : "fixture-other",
                }),
                { status: 200 },
              )
            : originalFetch(url, init),
        ),
      );
      const nativeGlobal = p
        .load("node:vm")
        .runInThisContext("globalThis") as typeof globalThis;
      expect(nativeGlobal.process.env.SUPABASE_URL).toBe(
        "https://auth.example.test",
      );
      const nativeFetch = nativeGlobal.fetch;
      nativeGlobal.fetch = globalThis.fetch;
      restoreNativeFetch = () => {
        nativeGlobal.fetch = nativeFetch;
      };
    });
    afterAll(async () => {
      if (server) await new Promise<void>((r) => server.close(() => r()));
      if (p) {
        const pool = p
          .load(path.join(p.dir, "src/lib/billing/db.js"))
          .getBillingDb();
        await pool?.end({ timeout: 5 });
      }
      await db?.end({ timeout: 5 });
      restoreNativeFetch();
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    });
    async function event(id: string, type: string, object: any) {
      const payload = JSON.stringify({ id, type, data: { object } });
      const signature = stripe.webhooks.generateTestHeaderString({
        payload,
        secret,
      });
      return originalFetch(base + "/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "stripe-signature": signature,
        },
        body: payload,
      });
    }
    async function entitlement(token = "fixture-buyer") {
      return (
        await originalFetch(base + "/me", {
          headers: { authorization: `Bearer ${token}` },
        })
      ).json();
    }
    it("requires verified identity and signed payment state, persists entitlement, deduplicates events and handles cancellation", async () => {
      expect(
        (
          await originalFetch(base + "/me", {
            headers: { cookie: "userId=fixture-buyer" },
          })
        ).status,
      ).toBe(401);
      expect(
        (
          await originalFetch(base + "/webhook", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "stripe-signature": "invalid",
            },
            body: "{}",
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await event("evt_checkout_fixture", "checkout.session.completed", {
            id: "cs_fixture",
            customer: "cus_fixture",
            subscription: "sub_fixture",
            client_reference_id: "fixture-buyer",
            metadata: { plan: "pro" },
          })
        ).status,
      ).toBe(200);
      expect(await entitlement()).toMatchObject({
        entitlements: { plan: "free" },
      });
      const subscription = {
        id: "sub_fixture",
        customer: "cus_fixture",
        status: "active",
        current_period_end: Math.floor(Date.now() / 1000) + 86400,
        metadata: { userId: "fixture-buyer", plan: "pro" },
        items: { data: [{ price: { id: "price_FIXTURE" } }] },
      };
      expect(
        (
          await event(
            "evt_subscription_fixture",
            "customer.subscription.updated",
            subscription,
          )
        ).status,
      ).toBe(200);
      expect((await entitlement()).entitlements.plan).toBe("pro");
      expect((await entitlement("fixture-other")).entitlements.plan).toBe(
        "free",
      );
      expect(
        (
          await event(
            "evt_subscription_fixture",
            "customer.subscription.updated",
            subscription,
          )
        ).status,
      ).toBe(200);
      expect(
        Number((await db`SELECT count(*) AS n FROM billing_events`)[0].n),
      ).toBe(2);
      expect(
        (
          await event("evt_failed_fixture", "invoice.payment_failed", {
            id: "in_fixture",
            subscription: "sub_fixture",
          })
        ).status,
      ).toBe(200);
      expect((await entitlement()).entitlements.plan).toBe("free");
      expect(
        (
          await event("evt_recovered_fixture", "invoice.paid", {
            id: "in_fixture",
            subscription: "sub_fixture",
          })
        ).status,
      ).toBe(200);
      expect((await entitlement()).entitlements.plan).toBe("pro");
      expect(
        (
          await event("evt_cancel_fixture", "customer.subscription.deleted", {
            ...subscription,
            status: "canceled",
          })
        ).status,
      ).toBe(200);
      expect((await entitlement()).entitlements.plan).toBe("free");
    });
    it("expires stale paid access and supports Stripe item-level billing periods", async () => {
      await db`INSERT INTO subscriptions(user_id, stripe_customer_id, plan, status, current_period_end) VALUES ('fixture-other','cus_expired_fixture','pro','active',NOW()-INTERVAL '1 day') ON CONFLICT(user_id) DO UPDATE SET plan='pro',status='active',current_period_end=NOW()-INTERVAL '1 day'`;
      expect((await entitlement("fixture-expired")).entitlements.plan).toBe(
        "free",
      );
      const end = Math.floor(Date.now() / 1000) + 86400;
      expect(
        (
          await event(
            "evt_modern_period_fixture",
            "customer.subscription.updated",
            {
              id: "sub_modern_fixture",
              customer: "cus_modern_fixture",
              status: "active",
              metadata: { userId: "fixture-other", plan: "pro" },
              items: {
                data: [
                  { price: { id: "price_FIXTURE" }, current_period_end: end },
                ],
              },
            },
          )
        ).status,
      ).toBe(200);
      expect(
        (await entitlement("fixture-modern")).entitlements.activeUntil,
      ).toBe(new Date(end * 1000).toISOString());
    });
    it("keeps generated billing tables private from client database roles", async () => {
      const rows =
        await db`SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('subscriptions','billing_events','billing_audit','billing_invoices')`;
      expect(rows).toHaveLength(4);
      expect(rows.every((row) => row.relrowsecurity === true)).toBe(true);
    });
  },
);
