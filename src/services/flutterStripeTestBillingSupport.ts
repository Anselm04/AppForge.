import type { ProductContract } from "../lib/productContract.js";
import { monetizationPolicy } from "../lib/monetizationImplementation.js";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function mergeNodeDependencies(
  current: string | undefined,
  required: Record<string, string>,
  devRequired: Record<string, string> = {},
): string {
  try {
    const parsed = current ? record(JSON.parse(current)) : {};
    return JSON.stringify(
      {
        ...parsed,
        dependencies: { ...record(parsed.dependencies), ...required },
        devDependencies: { ...record(parsed.devDependencies), ...devRequired },
      },
      null,
      2,
    );
  } catch {
    return JSON.stringify(
      { dependencies: required, devDependencies: devRequired },
      null,
      2,
    );
  }
}

function mergeEnvironmentExample(
  current: string | undefined,
  required: string,
): string {
  const lines = (current ?? "").split("\n").filter((line) => line.trim());
  const keys = new Set(
    lines
      .map((line) => /^([A-Z0-9_]+)=/.exec(line)?.[1])
      .filter((key): key is string => Boolean(key)),
  );
  for (const line of required.split("\n")) {
    const key = /^([A-Z0-9_]+)=/.exec(line)?.[1];
    if (key && !keys.has(key)) {
      lines.push(line);
      keys.add(key);
    }
  }
  return `${lines.join("\n")}\n`;
}

function stripeSource(subscription: boolean): string {
  return `import Stripe from 'stripe';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(name + ' is required');
  return value;
}

export function stripeTestClient(): Stripe {
  const key = required('STRIPE_SECRET_KEY');
  if (!key.startsWith('sk_test_')) {
    throw new Error('Generated AppForge billing is test-mode only until production certification');
  }
  return new Stripe(key, { maxNetworkRetries: 2, timeout: 15_000 });
}

export async function createCheckoutSession(input: {
  userId: string;
  email?: string;
}): Promise<Stripe.Checkout.Session> {
  const priceId = required('STRIPE_PRICE_ID');
  if (!priceId.startsWith('price_')) throw new Error('STRIPE_PRICE_ID must be a Stripe Price id');
  const successUrl = required('STRIPE_CHECKOUT_SUCCESS_URL');
  const cancelUrl = required('STRIPE_CHECKOUT_CANCEL_URL');
  return stripeTestClient().checkout.sessions.create({
    mode: '${subscription ? "subscription" : "payment"}',
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: input.userId,
    customer_email: input.email,
    metadata: { appforge_user_id: input.userId },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
}

export function verifyStripeWebhook(rawBody: Buffer, signature: string): Stripe.Event {
  const secret = required('STRIPE_WEBHOOK_SECRET');
  if (!secret.startsWith('whsec_')) throw new Error('STRIPE_WEBHOOK_SECRET is invalid');
  return stripeTestClient().webhooks.constructEvent(rawBody, signature, secret);
}
`;
}

function entitlementSource(): string {
  return `import pg from 'pg';
import type Stripe from 'stripe';

const { Pool } = pg;

function pool() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error('DATABASE_URL is required for billing entitlements');
  return new Pool({ connectionString, max: 5 });
}

function eventUserId(event: Stripe.Event): string | null {
  const object = event.data.object as Stripe.Checkout.Session | Stripe.Subscription | Stripe.Invoice;
  if ('metadata' in object && object.metadata?.appforge_user_id) return object.metadata.appforge_user_id;
  if ('client_reference_id' in object && typeof object.client_reference_id === 'string') return object.client_reference_id;
  return null;
}

function entitlementState(event: Stripe.Event): 'active' | 'inactive' | 'past_due' | null {
  if (event.type === 'checkout.session.completed' || event.type === 'invoice.paid') return 'active';
  if (event.type === 'invoice.payment_failed') return 'past_due';
  if (event.type === 'customer.subscription.deleted') return 'inactive';
  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription;
    return ['active', 'trialing'].includes(subscription.status) ? 'active' :
      subscription.status === 'past_due' ? 'past_due' : 'inactive';
  }
  return null;
}

export async function applyVerifiedStripeEvent(event: Stripe.Event): Promise<'applied' | 'duplicate' | 'ignored'> {
  const db = pool();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      'insert into public.stripe_webhook_events(provider_event_id, event_type) values ($1, $2) on conflict (provider_event_id) do nothing returning provider_event_id',
      [event.id, event.type],
    );
    if (inserted.rowCount !== 1) {
      await client.query('ROLLBACK');
      return 'duplicate';
    }

    const state = entitlementState(event);
    const userId = eventUserId(event);
    if (!state || !userId) {
      await client.query('COMMIT');
      return 'ignored';
    }
    await client.query(
      'insert into public.billing_entitlements(user_id, provider, status, provider_event_id, updated_at) values ($1, $2, $3, $4, now()) on conflict (user_id, provider) do update set status = excluded.status, provider_event_id = excluded.provider_event_id, updated_at = now()',
      [userId, 'stripe', state, event.id],
    );
    await client.query('COMMIT');
    return 'applied';
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await db.end();
  }
}

export async function requireActiveEntitlement(userId: string): Promise<void> {
  const db = pool();
  try {
    const result = await db.query(
      'select status from public.billing_entitlements where user_id = $1 and provider = $2 limit 1',
      [userId, 'stripe'],
    );
    if (result.rows[0]?.status !== 'active') {
      const error = new Error('Active paid entitlement required');
      Object.assign(error, { statusCode: 403 });
      throw error;
    }
  } finally {
    await db.end();
  }
}
`;
}

function migrationSource(): string {
  return `create table if not exists public.billing_entitlements (
  user_id uuid not null,
  provider text not null,
  status text not null check (status in ('active', 'inactive', 'past_due')),
  provider_event_id text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

create table if not exists public.stripe_webhook_events (
  provider_event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

alter table public.billing_entitlements enable row level security;
alter table public.stripe_webhook_events enable row level security;
revoke all on table public.billing_entitlements from anon, authenticated;
revoke all on table public.stripe_webhook_events from anon, authenticated;
`;
}

/** Adds test-mode-only Stripe billing support to generated Flutter+Node products. */
export function applyFlutterStripeTestBillingSupport(
  generatedFiles: Record<string, string>,
  productContract: ProductContract,
): Record<string, string> {
  if (productContract.selectedTechnologyStack !== "flutter-node")
    return { ...generatedFiles };
  const policy = monetizationPolicy(productContract);
  const stripeRequested =
    policy.required &&
    (/stripe/i.test(policy.provider ?? "") ||
      productContract.integrations.some((integration) =>
        /stripe/i.test(integration),
      ));
  if (!stripeRequested) return { ...generatedFiles };

  const files = { ...generatedFiles };
  files["package.json"] = mergeNodeDependencies(
    files["package.json"],
    { stripe: "^23.0.0", pg: "^8.13.0" },
    { "@types/pg": "^8.11.0" },
  );
  files["server/.env.example"] = mergeEnvironmentExample(
    files["server/.env.example"],
    [
      "STRIPE_SECRET_KEY=",
      "STRIPE_WEBHOOK_SECRET=",
      "STRIPE_PRICE_ID=",
      "STRIPE_CHECKOUT_SUCCESS_URL=",
      "STRIPE_CHECKOUT_CANCEL_URL=",
      "DATABASE_URL=",
      "",
    ].join("\n"),
  );
  if (!files["server/src/billing/stripe.ts"]?.trim()) {
    files["server/src/billing/stripe.ts"] = stripeSource(
      policy.models.includes("subscription"),
    );
  }
  if (!files["server/src/billing/entitlements.ts"]?.trim()) {
    files["server/src/billing/entitlements.ts"] = entitlementSource();
  }
  if (!files["database/migrations/002_billing_entitlements.sql"]?.trim()) {
    files["database/migrations/002_billing_entitlements.sql"] =
      migrationSource();
  }
  if (!files["docs/BILLING.md"]?.trim()) {
    files["docs/BILLING.md"] = [
      "# Billing",
      "",
      "This generated integration is intentionally restricted to Stripe test mode until production credentials and deployment are separately certified.",
      "",
      "- Configure a Stripe test Price and place its `price_...` id in `STRIPE_PRICE_ID`.",
      "- Use only an `sk_test_...` secret key. Live keys are rejected by generated code.",
      "- Configure a test webhook endpoint and `whsec_...` signing secret.",
      "- Apply generated database migrations before starting the backend.",
      "- Paid access is enforced server-side from verified webhook-derived entitlements.",
      "- Duplicate webhook event ids are ignored inside the same database transaction as entitlement changes.",
      "",
    ].join("\n");
  }

  const currentApi = (() => {
    try {
      return files["shared/contracts/product-api.json"]
        ? record(JSON.parse(files["shared/contracts/product-api.json"]))
        : {};
    } catch {
      return {};
    }
  })();
  files["shared/contracts/product-api.json"] = JSON.stringify(
    {
      ...currentApi,
      billing: {
        provider: "stripe",
        testModeOnly: true,
        serverAuthoritative: true,
        webhookSignatureRequired: true,
        providerEventDeduplication: true,
        durableEntitlements: true,
        runtimeVerified: false,
      },
    },
    null,
    2,
  );
  return files;
}
