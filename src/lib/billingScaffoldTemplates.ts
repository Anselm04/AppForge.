/** Shared file templates merged into income-oriented generated apps. */

export function billingDbModule(): string {
  return `import postgres from "postgres";

let pool: ReturnType<typeof postgres> | null = null;

/** Lazy Postgres pool — requires DATABASE_URL in production. */
export function getBillingDb() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!pool) pool = postgres(url, { max: 5, idle_timeout: 20 });
  return pool;
}
`;
}

export function billingSubscriptionsModule(): string {
  return `import { getBillingDb } from "./db.js";
import { planFromPriceId } from "./catalog.js";

export type SubscriptionRow = {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: string;
  status: string;
  current_period_end: Date | null;
};

export async function upsertFromCheckoutSession(session: {
  id: string;
  customer?: string | { id?: string } | null;
  subscription?: string | { id?: string } | null;
  client_reference_id?: string | null;
  customer_email?: string | null;
  metadata?: Record<string, string>;
}): Promise<void> {
  const sql = getBillingDb();
  if (!sql) {
    console.warn("[billing] DATABASE_URL not set — subscription not persisted");
    return;
  }
  const userId =
    session.client_reference_id ??
    session.metadata?.userId ??
    session.customer_email ??
    "anonymous";
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;

  const requestedPlan =
    session.metadata?.plan === "enterprise" ? "enterprise" : "pro";
  await sql\`
    INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, plan, status)
    VALUES (\${userId}, \${customerId}, \${subscriptionId}, \${requestedPlan}, 'pending')
    ON CONFLICT (user_id) DO UPDATE SET
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      plan = CASE
        WHEN subscriptions.status NOT IN ('inactive', 'pending')
          THEN subscriptions.plan
        ELSE EXCLUDED.plan
      END,
      status = CASE
        WHEN subscriptions.status NOT IN ('inactive', 'pending')
          THEN subscriptions.status
        ELSE 'pending'
      END,
      updated_at = NOW()
  \`;
}

export async function updateFromStripeSubscription(sub: {
  id: string;
  customer: string | { id?: string };
  status: string;
  current_period_end?: number;
  metadata?: Record<string, string>;
  items?: { data?: Array<{ price?: { id?: string } }> };
}): Promise<void> {
  const sql = getBillingDb();
  if (!sql) return;
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const userId = sub.metadata?.userId ?? customerId ?? sub.id;
  const priceId = sub.items?.data?.[0]?.price?.id ?? null;
  const configuredPlan = planFromPriceId(priceId);
  const plan =
    sub.status === "active" || sub.status === "trialing"
      ? configuredPlan === "free"
        ? sub.metadata?.plan === "enterprise"
          ? "enterprise"
          : "pro"
        : configuredPlan
      : "free";
  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000)
    : null;

  const updated = await sql<{ user_id: string }[]>\`
    UPDATE subscriptions
    SET stripe_subscription_id = \${sub.id},
        plan = \${plan},
        status = \${sub.status},
        current_period_end = \${periodEnd},
        updated_at = NOW()
    WHERE stripe_customer_id = \${customerId}
       OR stripe_subscription_id = \${sub.id}
    RETURNING user_id
  \`;

  if (updated.length === 0) {
    await sql\`
      INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end)
      VALUES (\${userId}, \${customerId}, \${sub.id}, \${plan}, \${sub.status}, \${periodEnd})
      ON CONFLICT (user_id) DO UPDATE SET
        stripe_customer_id = EXCLUDED.stripe_customer_id,
        stripe_subscription_id = EXCLUDED.stripe_subscription_id,
        plan = EXCLUDED.plan,
        status = EXCLUDED.status,
        current_period_end = EXCLUDED.current_period_end,
        updated_at = NOW()
    \`;
  }
}

export async function getSubscriptionByUserId(
  userId: string,
): Promise<SubscriptionRow | null> {
  const sql = getBillingDb();
  if (!sql) return null;
  const rows = await sql<SubscriptionRow[]>\`
    SELECT user_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end
    FROM subscriptions WHERE user_id = \${userId} LIMIT 1
  \`;
  return rows[0] ?? null;
}
`;
}

export function billingEntitlementsModule(): string {
  return `import {
  getSubscriptionByUserId,
  type SubscriptionRow,
} from "./subscriptions.js";

export type Plan = "free" | "pro" | "enterprise";

export type UserEntitlements = {
  plan: Plan;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  activeUntil?: string;
  status?: string;
};

function rowToEntitlements(row: SubscriptionRow): UserEntitlements {
  const active =
    row.status === "active" ||
    row.status === "trialing";
  const plan: Plan =
    active && row.plan === "enterprise"
      ? "enterprise"
      : active && row.plan === "pro"
        ? "pro"
        : "free";
  return {
    plan,
    stripeCustomerId: row.stripe_customer_id ?? undefined,
    stripeSubscriptionId: row.stripe_subscription_id ?? undefined,
    activeUntil: row.current_period_end?.toISOString(),
    status: row.status,
  };
}

/** Load entitlements from Postgres (DATABASE_URL required). */
export async function getEntitlements(userId: string): Promise<UserEntitlements> {
  const row = await getSubscriptionByUserId(userId);
  if (!row) return { plan: "free" };
  return rowToEntitlements(row);
}

export function canAccessFeature(
  entitlements: UserEntitlements,
  feature: string,
): boolean {
  if (entitlements.plan === "enterprise") return true;
  if (entitlements.plan === "pro") return feature !== "enterprise_only";
  return feature === "free";
}
`;
}

export function billingCatalogModule(): string {
  return `export type BillingPlan = "free" | "pro" | "enterprise";

export type BillingCatalogEntry = {
  plan: BillingPlan;
  product: string;
  priceId: string | null;
  interval: "month" | "year" | null;
};

export function getBillingCatalog(): BillingCatalogEntry[] {
  return [
    { plan: "free", product: "Free", priceId: null, interval: null },
    {
      plan: "pro",
      product: "Pro",
      priceId: process.env.STRIPE_PRICE_ID ?? null,
      interval: "month",
    },
    {
      plan: "enterprise",
      product: "Enterprise",
      priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID ?? null,
      interval: "month",
    },
  ];
}

export function resolveBillingPlan(plan: string): BillingCatalogEntry {
  const entry = getBillingCatalog().find((candidate) => candidate.plan === plan);
  if (!entry || entry.plan === "free" || !entry.priceId) {
    throw new Error("Requested paid billing plan is not configured");
  }
  return entry;
}

export function planFromPriceId(priceId?: string | null): BillingPlan {
  if (!priceId) return "free";
  return getBillingCatalog().find((entry) => entry.priceId === priceId)?.plan ?? "free";
}
`;
}

export function billingLimitsModule(): string {
  return `import { getEntitlements } from "./entitlements.js";

export const PLAN_LIMITS = {
  free: { monthlyActions: 10 },
  pro: { monthlyActions: 1000 },
  enterprise: { monthlyActions: 100000 },
} as const;

export async function requirePaidAccess(userId: string, feature = "pro") {
  const entitlements = await getEntitlements(userId);
  const allowed =
    entitlements.plan === "enterprise" ||
    (entitlements.plan === "pro" && feature !== "enterprise_only");
  if (!allowed) {
    const error = new Error("Paid entitlement required") as Error & { statusCode?: number };
    error.statusCode = 402;
    throw error;
  }
  return {
    entitlements,
    limits: PLAN_LIMITS[entitlements.plan],
  };
}
`;
}

export function billingAuditModule(): string {
  return `import { randomUUID } from "node:crypto";
import { getBillingDb } from "./db.js";

const BILLING_EVENT_LEASE_MS = 5 * 60 * 1000;
const BILLING_EVENT_HEARTBEAT_MS = 60 * 1000;

export async function processBillingEventOnce(
  eventId: string,
  eventType: string,
  handler: () => Promise<void>,
): Promise<{ duplicate: boolean }> {
  const sql = getBillingDb();
  if (!sql) throw new Error("Billing database is not configured");

  const claimOwner = randomUUID();
  const claimed = await sql<{ id: string; claim_owner: string }[]>\`
    INSERT INTO billing_events (
      id,
      event_type,
      status,
      claim_owner,
      created_at,
      updated_at
    )
    VALUES (
      \${eventId},
      \${eventType},
      'processing',
      \${claimOwner},
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE
      SET status = 'processing',
          claim_owner = EXCLUDED.claim_owner,
          error = NULL,
          updated_at = NOW()
      WHERE billing_events.status = 'failed'
         OR (
           billing_events.status = 'processing'
           AND billing_events.updated_at
             < NOW() - (\${BILLING_EVENT_LEASE_MS} * INTERVAL '1 millisecond')
         )
    RETURNING id, claim_owner
  \`;
  if (!claimed[0] || claimed[0].claim_owner !== claimOwner) {
    return { duplicate: true };
  }

  const renewLease = async () => {
    await sql\`
      UPDATE billing_events
      SET updated_at = NOW()
      WHERE id = \${eventId}
        AND claim_owner = \${claimOwner}
        AND status = 'processing'
    \`;
  };

  const heartbeat = setInterval(() => {
    void renewLease().catch((error) => {
      console.error("[billing] failed to renew billing event lease", error);
    });
  }, BILLING_EVENT_HEARTBEAT_MS);
  heartbeat.unref?.();

  try {
    await handler();
    const finalized = await sql<{ id: string }[]>\`
      UPDATE billing_events
      SET status = 'processed',
          processed_at = NOW(),
          updated_at = NOW(),
          error = NULL,
          claim_owner = NULL
      WHERE id = \${eventId}
        AND claim_owner = \${claimOwner}
        AND status = 'processing'
      RETURNING id
    \`;
    if (!finalized[0]) {
      throw new Error("Billing event claim was lost before completion");
    }
    return { duplicate: false };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.slice(0, 1000)
        : "Billing event failed";
    await sql\`
      UPDATE billing_events
      SET status = 'failed',
          error = \${message},
          updated_at = NOW(),
          claim_owner = NULL
      WHERE id = \${eventId}
        AND claim_owner = \${claimOwner}
        AND status = 'processing'
    \`;
    throw error;
  } finally {
    clearInterval(heartbeat);
  }
}

export async function auditBillingAction(
  eventId: string,
  eventType: string,
  outcome: "processed" | "failed",
): Promise<void> {
  const sql = getBillingDb();
  if (!sql) return;
  await sql\`
    INSERT INTO billing_audit (event_id, event_type, outcome, created_at)
    VALUES (\${eventId}, \${eventType}, \${outcome}, NOW())
  \`;
}
`;
}

export function billingInvoicesModule(): string {
  return `import { getBillingDb } from "./db.js";

export async function recordInvoiceState(input: {
  invoiceId: string;
  subscriptionId?: string | null;
  state: "paid" | "payment_failed";
}): Promise<void> {
  const sql = getBillingDb();
  if (!sql) throw new Error("Billing database is not configured");
  await sql\`
    INSERT INTO billing_invoices (invoice_id, subscription_id, state, updated_at)
    VALUES (\${input.invoiceId}, \${input.subscriptionId ?? null}, \${input.state}, NOW())
    ON CONFLICT (invoice_id) DO UPDATE SET
      subscription_id = EXCLUDED.subscription_id,
      state = EXCLUDED.state,
      updated_at = NOW()
  \`;
  if (input.subscriptionId) {
    await sql\`
      UPDATE subscriptions
      SET
        status = \${input.state === "paid" ? "active" : "past_due"},
        updated_at = NOW()
      WHERE stripe_subscription_id = \${input.subscriptionId}
    \`;
  }
}
`;
}

export function billingRefundsModule(): string {
  return `import { auditBillingAction } from "./audit.js";

export async function refundPayment(input: {
  paymentIntentId: string;
  amount?: number;
  reason?: "duplicate" | "fraudulent" | "requested_by_customer";
}) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) throw new Error("Stripe billing is unconfigured");
  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
  const refund = await stripe.refunds.create(
    {
      payment_intent: input.paymentIntentId,
      amount: input.amount,
      reason: input.reason,
    },
    { idempotencyKey: \`refund:\${input.paymentIntentId}:\${input.amount ?? "full"}\` },
  );
  await auditBillingAction(refund.id, "refund.created", "processed");
  return refund;
}
`;
}

export function billingHealthModule(): string {
  return `import { resolveBillingPlan } from "./catalog.js";

export type BillingHealth = {
  configured: boolean;
  verified: boolean;
  state: "unconfigured" | "needs_attention" | "connected";
  message: string;
};

export async function verifyBillingHealth(): Promise<BillingHealth> {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const databaseUrl = process.env.DATABASE_URL;
  if (!stripeKey || !webhookSecret || !databaseUrl) {
    return {
      configured: false,
      verified: false,
      state: "unconfigured",
      message: "Billing configuration is incomplete",
    };
  }
  try {
    const plan = resolveBillingPlan("pro");
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
    await stripe.prices.retrieve(plan.priceId!);
    return {
      configured: true,
      verified: true,
      state: "connected",
      message: "Billing provider and configured price verified",
    };
  } catch (error) {
    return {
      configured: true,
      verified: false,
      state: "needs_attention",
      message: error instanceof Error ? error.message : "Billing verification failed",
    };
  }
}
`;
}

export function billingHealthRoutes(): {
  nextRoute: string;
  expressRoute: string;
} {
  const nextRoute = `import { NextResponse } from "next/server";
import { verifyBillingHealth } from "../../../../lib/billing/health.js";

export async function GET() {
  const health = await verifyBillingHealth();
  return NextResponse.json(health, { status: health.verified ? 200 : 503 });
}
`;

  const expressRoute = `import type { Request, Response } from "express";
import { verifyBillingHealth } from "../../../lib/billing/health.js";

export async function getBillingHealth(_req: Request, res: Response) {
  const health = await verifyBillingHealth();
  res.status(health.verified ? 200 : 503).json(health);
}
`;

  return { nextRoute, expressRoute };
}

export function billingPortalRoutes(isNext: boolean): {
  nextRoute: string;
  expressRoute: string;
} {
  const nextRoute = `import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "../../../../lib/auth/session.js";
import { getSubscriptionByUserId } from "../../../../lib/billing/subscriptions.js";

export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const appUrl = process.env.APP_URL;
  if (!stripeKey || !appUrl) {
    return NextResponse.json({ error: "Billing portal is unconfigured" }, { status: 503 });
  }
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const subscription = await getSubscriptionByUserId(userId);
  if (!subscription?.stripe_customer_id) {
    return NextResponse.json({ error: "No billing customer" }, { status: 409 });
  }
  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: appUrl + "/account",
  });
  return NextResponse.json({ url: session.url });
}
`;

  const expressRoute = `import type { Request, Response } from "express";
import { getUserIdFromRequest } from "../../lib/auth/session.js";
import { getSubscriptionByUserId } from "../../lib/billing/subscriptions.js";

export async function createBillingPortal(req: Request, res: Response) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const appUrl = process.env.APP_URL;
  if (!stripeKey || !appUrl) {
    res.status(503).json({ error: "Billing portal is unconfigured" });
    return;
  }
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const subscription = await getSubscriptionByUserId(userId);
  if (!subscription?.stripe_customer_id) {
    res.status(409).json({ error: "No billing customer" });
    return;
  }
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: appUrl + "/account",
  });
  res.json({ url: session.url });
}
`;
  return { nextRoute, expressRoute };
}

export function billingWebhookHandlers(isNext: boolean): {
  nextRoute: string;
  expressRoute: string;
} {
  const handlerBody = `
  await processBillingEventOnce(event.id, event.type, async () => {
    if (event.type === "checkout.session.completed") {
      await upsertFromCheckoutSession(event.data.object);
    }
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      await updateFromStripeSubscription(event.data.object);
    }
    if (event.type === "invoice.paid") {
      const invoice = event.data.object;
      await recordInvoiceState({
        invoiceId: invoice.id,
        subscriptionId:
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id ?? null,
        state: "paid",
      });
    }
    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      await recordInvoiceState({
        invoiceId: invoice.id,
        subscriptionId:
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id ?? null,
        state: "payment_failed",
      });
    }
    if (event.type === "charge.refunded") {
      await auditBillingAction(event.id, "charge.refunded", "processed");
    }
  });`;

  const nextRoute = `import { NextResponse } from "next/server";
import {
  upsertFromCheckoutSession,
  updateFromStripeSubscription,
} from "../../../../lib/billing/subscriptions.js";
import {
  auditBillingAction,
  processBillingEventOnce,
} from "../../../../lib/billing/audit.js";
import { recordInvoiceState } from "../../../../lib/billing/invoices.js";

export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }
  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
${handlerBody}
  return NextResponse.json({ received: true });
}
`;

  const expressRoute = `import type { Request, Response } from "express";
import {
  upsertFromCheckoutSession,
  updateFromStripeSubscription,
} from "../../lib/billing/subscriptions.js";
import {
  auditBillingAction,
  processBillingEventOnce,
} from "../../lib/billing/audit.js";
import { recordInvoiceState } from "../../lib/billing/invoices.js";

export async function stripeWebhook(req: Request, res: Response) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey || !webhookSecret) {
    res.status(503).send("Stripe not configured");
    return;
  }
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
  const sig = req.headers["stripe-signature"];
  if (!sig || typeof sig !== "string") {
    res.status(400).send("Missing signature");
    return;
  }
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch {
    res.status(400).send("Invalid signature");
    return;
  }
${handlerBody}
  res.json({ received: true });
}
`;

  return { nextRoute, expressRoute };
}

export function billingSchemaSql(): string {
  return `-- Run once against production: psql "$DATABASE_URL" -f database/billing-schema.sql
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL UNIQUE,
  stripe_customer_id VARCHAR(255) UNIQUE,
  stripe_subscription_id VARCHAR(255) UNIQUE,
  plan VARCHAR(50) NOT NULL DEFAULT 'free',
  status VARCHAR(50) NOT NULL DEFAULT 'inactive',
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS billing_events (
  id VARCHAR(255) PRIMARY KEY,
  event_type VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  claim_owner VARCHAR(255),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
ALTER TABLE billing_events
  ADD COLUMN IF NOT EXISTS claim_owner VARCHAR(255);
CREATE TABLE IF NOT EXISTS billing_audit (
  id BIGSERIAL PRIMARY KEY,
  event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(255) NOT NULL,
  outcome VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS billing_invoices (
  invoice_id VARCHAR(255) PRIMARY KEY,
  subscription_id VARCHAR(255),
  state VARCHAR(50) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_status ON billing_events(status);
CREATE INDEX IF NOT EXISTS idx_billing_audit_event ON billing_audit(event_id);
`;
}

export function billingSetupReadme(isNext: boolean): string {
  return `# Billing setup (generated by AppForge)

This product requested monetization. Billing stays **unconfigured** until all server configuration below exists and the billing health check verifies the configured Stripe price.

## Environment

- \`DATABASE_URL\`
- \`STRIPE_SECRET_KEY\`
- \`STRIPE_WEBHOOK_SECRET\`
- \`STRIPE_PRICE_ID\` for Pro
- \`STRIPE_ENTERPRISE_PRICE_ID\` when Enterprise is offered
- \`APP_URL\`

Never put Stripe secret keys, webhook secrets, customer IDs, subscription state, or entitlements in client-controlled storage.

## Setup

1. Create the Stripe products/prices represented by \`src/lib/billing/catalog.ts\`.
2. Set the server environment variables above.
3. Run: \`psql "$DATABASE_URL" -f database/billing-schema.sql\`.
4. Register the signed webhook at \${APP_URL}/api/webhooks/stripe.
5. Enable these events: checkout.session.completed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted, invoice.paid, invoice.payment_failed, charge.refunded.
6. Verify \`verifyBillingHealth()\` returns \`configured: true\`, \`verified: true\`, and \`state: "connected"\` before advertising monetization as active.
7. Test checkout with Stripe test mode, then verify the server subscription/entitlement record before paid functionality unlocks.
8. Test Customer Portal upgrades, downgrades, and cancellation. Portal changes are not trusted until signed Stripe webhooks update the server subscription.
9. Test invoice paid and failed-payment events. \`past_due\`, canceled, inactive, and unpaid states must not receive paid entitlements.
10. Test a refund and confirm the billing audit/event ledger records the outcome.
11. Replay a webhook event ID and verify duplicate processing is rejected by the billing event ledger.

## Server authority

The browser may display billing state returned by \`/api/billing/me\`, but it never decides entitlement. Paid server actions must call the server entitlement/access-limit helpers.

## Recovery and reconciliation

Billing webhooks are idempotent. Failed events are recorded as failed and may be retried; do not manually mark an event processed without reconciling the corresponding Stripe object and local ledger.

\${isNext ? "Next.js: the webhook route reads the raw request body." : "Express: mount stripeWebhook with express.raw({ type: 'application/json' }) before express.json()."}
`;
}

export function billingSessionModule(): string {
  return `/** Minimal session helper — replace with Supabase/Clerk/NextAuth in production. */
export function getUserIdFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\\s*)userId=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function getUserIdFromRequest(req: { headers: { get?(n: string): string | null; cookie?: string } }): string | null {
  if (typeof req.headers.get === "function") {
    return getUserIdFromCookie(req.headers.get("cookie"));
  }
  return getUserIdFromCookie(req.headers.cookie ?? null);
}
`;
}

export function billingMeRoute(isNext: boolean): string | null {
  if (!isNext) return null;
  return `import { NextResponse } from "next/server";
import { getEntitlements } from "../../../../lib/billing/entitlements.js";
import { getUserIdFromRequest } from "../../../../lib/auth/session.js";

export async function GET(req: Request) {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const entitlements = await getEntitlements(userId);
  return NextResponse.json({ userId, entitlements });
}
`;
}

export function billingExpressMeRoute(): string {
  return `import type { Request, Response } from "express";
import { getEntitlements } from "../../lib/billing/entitlements.js";
import { getUserIdFromRequest } from "../../lib/auth/session.js";

export async function getBillingMe(req: Request, res: Response) {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const entitlements = await getEntitlements(userId);
  res.json({ userId, entitlements });
}
`;
}

export function requireProComponent(): string {
  return `import { useEffect, useState, type ReactNode } from "react";

type Entitlements = {
  plan: "free" | "pro" | "enterprise";
  status?: string;
};

type Props = {
  feature?: string;
  children: ReactNode;
  fallback?: ReactNode;
};

export function RequirePro({ feature = "pro", children, fallback }: Props) {
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/billing/me", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load billing entitlements");
        return response.json();
      })
      .then((data) => {
        if (!cancelled) setEntitlements(data.entitlements);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Billing unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p>{error}</p>;
  if (!entitlements) return <p>Loading…</p>;

  const paid =
    entitlements.status === "active" || entitlements.status === "trialing";
  const allowed =
    paid &&
    (entitlements.plan === "enterprise" ||
      (entitlements.plan === "pro" && feature !== "enterprise_only"));

  if (!allowed) {
    return (
      fallback ?? (
        <p>
          Paid subscription required. <a href="/pricing">Upgrade</a>
        </p>
      )
    );
  }
  return <>{children}</>;
}
`;
}
