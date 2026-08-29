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

  await sql\`
    INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, plan, status)
    VALUES (\${userId}, \${customerId}, \${subscriptionId}, 'pro', 'active')
    ON CONFLICT (user_id) DO UPDATE SET
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      plan = 'pro',
      status = 'active',
      current_period_end = NOW() + INTERVAL '30 days'
  \`;
}

export async function updateFromStripeSubscription(sub: {
  id: string;
  customer: string | { id?: string };
  status: string;
  current_period_end?: number;
  metadata?: Record<string, string>;
}): Promise<void> {
  const sql = getBillingDb();
  if (!sql) return;
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const userId = sub.metadata?.userId ?? customerId ?? sub.id;
  const plan = sub.status === "active" || sub.status === "trialing" ? "pro" : "free";
  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000)
    : null;

  await sql\`
    INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end)
    VALUES (\${userId}, \${customerId}, \${sub.id}, \${plan}, \${sub.status}, \${periodEnd})
    ON CONFLICT (user_id) DO UPDATE SET
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      plan = EXCLUDED.plan,
      status = EXCLUDED.status,
      current_period_end = EXCLUDED.current_period_end
  \`;
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
    row.status === "trialing" ||
    (row.current_period_end && row.current_period_end > new Date());
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

export function billingWebhookHandlers(isNext: boolean): {
  nextRoute: string;
  expressRoute: string;
} {
  const importPath = isNext
    ? "../lib/billing/subscriptions.js"
    : "../../lib/billing/subscriptions.js";
  const handlerBody = `
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    await upsertFromCheckoutSession(session);
  }
  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    await updateFromStripeSubscription(event.data.object);
  }`;

  const nextRoute = `import { NextResponse } from "next/server";
import {
  upsertFromCheckoutSession,
  updateFromStripeSubscription,
} from "../../../../lib/billing/subscriptions.js";

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
} from "${importPath}";

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
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  plan VARCHAR(50) DEFAULT 'free',
  status VARCHAR(50) DEFAULT 'inactive',
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
`;
}

export function billingSetupReadme(isNext: boolean): string {
  return `# Billing setup (generated by AppForge)

1. Set \`DATABASE_URL\` on your host (Neon, Supabase, or any Postgres).
2. Run migration: \`psql "$DATABASE_URL" -f database/billing-schema.sql\`
3. Set Stripe env vars: \`STRIPE_SECRET_KEY\`, \`STRIPE_WEBHOOK_SECRET\`, \`STRIPE_PRICE_ID\`, \`APP_URL\`
4. Register webhook: \${APP_URL}/api/webhooks/stripe
5. Test checkout with card 4242 4242 4242 4242
6. Verify \`subscriptions\` row updates and pro routes unlock via \`getEntitlements(userId)\`

${isNext ? "Next.js: webhook route uses raw body automatically." : "Express: mount stripeWebhook with express.raw({ type: 'application/json' }) before express.json()."}
`;
}
