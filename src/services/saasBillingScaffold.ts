/** Stripe billing scaffold merged into income-oriented builds (Fintech capability). */

import {
  billingAuditModule,
  billingCatalogModule,
  billingDbModule,
  billingEntitlementsModule,
  billingExpressMeRoute,
  billingHealthModule,
  billingHealthRoutes,
  billingInvoicesModule,
  billingLimitsModule,
  billingMeRoute,
  billingPortalRoutes,
  billingRefundsModule,
  billingSchemaSql,
  billingSessionModule,
  billingSetupReadme,
  billingSubscriptionsModule,
  billingWebhookHandlers,
  requireProComponent,
} from "../lib/billingScaffoldTemplates.js";
import {
  validateProductContract,
  type ProductContract,
} from "../lib/productContract.js";

type Files = Record<string, string>;

export const BILLING_REQUIRED_PATHS = [
  "billing/stripe-manifest.json",
  "src/lib/billing/catalog.ts",
  "src/lib/billing/db.ts",
  "src/lib/billing/subscriptions.ts",
  "src/lib/billing/entitlements.ts",
  "src/lib/billing/limits.ts",
  "src/lib/billing/audit.ts",
  "src/lib/billing/invoices.ts",
  "src/lib/billing/refunds.ts",
  "src/lib/billing/health.ts",
  "database/billing-schema.sql",
] as const;

/**
 * The Stripe billing scaffold is React components plus Express / Next.js
 * route handlers, so it only exists for the React + Node web stacks. Other
 * stacks (games, services, Python, mobile, desktop, extensions) never get
 * React/Express files merged in; billing there is implemented natively by
 * the generator for that stack.
 */
export const BILLING_SCAFFOLD_STACKS = [
  "react-node",
  "data-visualization",
  "next-node",
] as const;

export function billingScaffoldSupported(techStack: string): boolean {
  return (BILLING_SCAFFOLD_STACKS as readonly string[]).includes(techStack);
}

export function billingScaffoldFiles(techStack: string): Files {
  if (!billingScaffoldSupported(techStack)) {
    throw new Error(
      `The Stripe billing scaffold is React + Node only; it is not merged into ${techStack} projects`,
    );
  }
  const isNext = techStack.includes("next");
  const webhooks = billingWebhookHandlers(isNext);
  const portals = billingPortalRoutes(isNext);
  const healthRoutes = billingHealthRoutes();

  const checkoutRoute = isNext
    ? `import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "../../../lib/auth/session.js";
import { resolveBillingPlan } from "../../../lib/billing/catalog.js";

export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY not configured" }, { status: 503 });
  }
  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
  const body = (await req.json()) as { plan?: string };
  const sessionUserId = getUserIdFromRequest(req);
  if (!sessionUserId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  let selectedPlan;
  try {
    selectedPlan = resolveBillingPlan(body.plan ?? "pro");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Billing plan unavailable" },
      { status: 503 },
    );
  }
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: selectedPlan.priceId!, quantity: 1 }],
    success_url: \`\${process.env.APP_URL ?? "http://localhost:3000"}/billing/success?session_id={CHECKOUT_SESSION_ID}\`,
    cancel_url: \`\${process.env.APP_URL ?? "http://localhost:3000"}/pricing\`,
    client_reference_id: sessionUserId,
    metadata: sessionUserId
      ? { userId: sessionUserId, plan: selectedPlan.plan }
      : { plan: selectedPlan.plan },
    subscription_data: {
      metadata: sessionUserId
        ? { userId: sessionUserId, plan: selectedPlan.plan }
        : { plan: selectedPlan.plan },
    },
  });
  return NextResponse.json({ url: session.url });
}
`
    : `import type { Request, Response } from "express";
import { getUserIdFromRequest } from "../../lib/auth/session.js";
import { resolveBillingPlan } from "../../lib/billing/catalog.js";

export async function createCheckoutSession(req: Request, res: Response) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    res.status(503).json({ error: "STRIPE_SECRET_KEY not configured" });
    return;
  }
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
  const { plan } = req.body as { plan?: string };
  let selectedPlan;
  try {
    selectedPlan = resolveBillingPlan(plan ?? "pro");
  } catch (error) {
    res.status(503).json({
      error: error instanceof Error ? error.message : "Billing plan unavailable",
    });
    return;
  }
  const sessionUserId = getUserIdFromRequest(req);
  if (!sessionUserId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: selectedPlan.priceId!, quantity: 1 }],
    success_url: \`\${process.env.APP_URL ?? "http://localhost:5173"}/billing/success?session_id={CHECKOUT_SESSION_ID}\`,
    cancel_url: \`\${process.env.APP_URL ?? "http://localhost:5173"}/pricing\`,
    client_reference_id: sessionUserId,
    metadata: { userId: sessionUserId, plan: selectedPlan.plan },
    subscription_data: {
      metadata: { userId: sessionUserId, plan: selectedPlan.plan },
    },
  });
  res.json({ url: session.url });
}
`;

  return {
    "billing/stripe-manifest.json": JSON.stringify(
      {
        provider: "stripe",
        mode: "subscription",
        requiredEnv: [
          "DATABASE_URL",
          "STRIPE_SECRET_KEY",
          "STRIPE_WEBHOOK_SECRET",
          "STRIPE_PRICE_ID",
          "APP_URL",
        ],
        clientEnv: ["VITE_STRIPE_PUBLISHABLE_KEY"],
        webhookEvents: [
          "checkout.session.completed",
          "customer.subscription.updated",
          "customer.subscription.deleted",
          "invoice.paid",
          "invoice.payment_failed",
          "charge.refunded",
        ],
        testCard: "4242 4242 4242 4242",
        migration: "database/billing-schema.sql",
      },
      null,
      2,
    ),
    "billing/SETUP.md": billingSetupReadme(isNext),
    "docs/BILLING.md": billingSetupReadme(isNext),
    ".env.example":
      [
        "DATABASE_URL=",
        "STRIPE_SECRET_KEY=",
        "STRIPE_WEBHOOK_SECRET=",
        "STRIPE_PRICE_ID=",
        "STRIPE_ENTERPRISE_PRICE_ID=",
        "APP_URL=",
      ].join("\n") + "\n",
    "src/lib/billing/catalog.ts": billingCatalogModule(),
    "src/lib/billing/db.ts": billingDbModule(),
    "src/lib/billing/subscriptions.ts": billingSubscriptionsModule(),
    "src/lib/billing/entitlements.ts": billingEntitlementsModule(),
    "src/lib/billing/limits.ts": billingLimitsModule(),
    "src/lib/billing/audit.ts": billingAuditModule(),
    "src/lib/billing/invoices.ts": billingInvoicesModule(),
    "src/lib/billing/refunds.ts": billingRefundsModule(),
    "src/lib/billing/health.ts": billingHealthModule(),
    "src/lib/auth/session.ts": billingSessionModule(),
    "src/components/RequirePro.tsx": requireProComponent(),
    "database/billing-schema.sql": billingSchemaSql(),
    ...(isNext
      ? {
          "src/app/api/checkout/route.ts": checkoutRoute,
          "src/app/api/webhooks/stripe/route.ts": webhooks.nextRoute,
          "src/app/api/billing/portal/route.ts": portals.nextRoute,
          "src/app/api/billing/health/route.ts": healthRoutes.nextRoute,
          ...(billingMeRoute(isNext)
            ? { "src/app/api/billing/me/route.ts": billingMeRoute(isNext)! }
            : {}),
        }
      : {
          "src/server/routes/billing/checkout.ts": checkoutRoute,
          "src/server/routes/billing/webhook.ts": webhooks.expressRoute,
          "src/server/routes/billing/me.ts": billingExpressMeRoute(),
          "src/server/routes/billing/portal.ts": portals.expressRoute,
          "src/server/routes/billing/health.ts": healthRoutes.expressRoute,
        }),
    "src/pages/PricingPage.tsx": `import { useState } from "react";

export function PricingPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(plan: "pro" | "enterprise" = "pro") {
    setLoading(true);
    setError(null);
    try {
      const endpoint = ${isNext ? '"/api/checkout"' : '"/api/billing/checkout"'};
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Checkout failed");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ fontFamily: "system-ui", padding: 24, maxWidth: 720 }}>
      <h1>Pricing</h1>
      <p>Start free. Upgrade when you need more.</p>
      <div style={{ display: "flex", gap: 16, marginTop: 24 }}>
        <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 16, flex: 1 }}>
          <h2>Pro</h2>
          <p>$29/mo</p>
          <button type="button" disabled={loading} onClick={() => startCheckout()}>
            {loading ? "Redirecting…" : "Subscribe"}
          </button>
        </div>
      </div>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </main>
  );
}
`,
    "src/pages/BillingSuccessPage.tsx": `export function BillingSuccessPage() {
  return (
    <main style={{ fontFamily: "system-ui", padding: 24 }}>
      <h1>Payment received</h1>
      <p>Billing confirmation is still being verified. Paid features unlock only after the signed provider webhook updates your server-side entitlement.</p>
    </main>
  );
}
`,
    "src/components/ManageBillingButton.tsx": `import { useState } from "react";

export function ManageBillingButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setLoading(true);
    setError(null);
    try {
      const endpoint = ${isNext ? '"/api/billing/portal"' : '"/api/billing/portal"'};
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error ?? "Billing portal unavailable");
      window.location.href = data.url;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Billing portal unavailable");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button type="button" disabled={loading} onClick={() => void openPortal()}>
        {loading ? "Opening billing…" : "Manage billing"}
      </button>
      {error && <p>{error}</p>}
    </div>
  );
}
`,
  };
}

export function mergeBillingScaffold(
  files: Files,
  techStack: string,
  fintechSchemaJson?: string,
  productContract?: ProductContract,
): Files {
  if (productContract) {
    const contract = validateProductContract(productContract);
    if (contract.monetizationRequirements.length === 0) {
      throw new Error(
        "Billing requested without monetization requirements in canonical product contract",
      );
    }
  }
  const billing = billingScaffoldFiles(techStack);
  const merged = { ...billing, ...files };

  if (fintechSchemaJson) {
    merged["fintech/fintech-schema.json"] = fintechSchemaJson;
  }

  const pkgPath = merged["package.json"];
  if (pkgPath) {
    try {
      const pkg = JSON.parse(pkgPath) as Record<string, unknown> & {
        dependencies?: Record<string, string>;
      };
      pkg.dependencies = {
        ...(pkg.dependencies ?? {}),
        stripe: "^14.0.0",
        postgres: "^3.4.0",
      };
      merged["package.json"] = JSON.stringify(pkg, null, 2);
    } catch {
      /* keep existing */
    }
  }

  return merged;
}

export function validateBillingScaffold(files: Files): {
  passed: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  const text = Object.keys(files).join("\n").toLowerCase();
  const content = Object.values(files).join("\n").toLowerCase();

  if (!text.includes("checkout") && !content.includes("checkout.sessions")) {
    missing.push("checkout route");
  }
  if (!text.includes("webhook") || !content.includes("stripe")) {
    missing.push("stripe webhook handler");
  }
  if (!content.includes("upsertfromcheckoutsession")) {
    missing.push("webhook persists subscriptions to DB");
  }
  if (
    !text.includes("subscriptions.ts") &&
    !content.includes("getsubscriptionbyuserid")
  ) {
    missing.push("subscriptions DB module");
  }
  if (!text.includes("entitlement") && !content.includes("getentitlements")) {
    missing.push("entitlements helper");
  }
  if (!content.includes("stripe")) {
    missing.push("stripe dependency or integration");
  }
  if (!content.includes("database_url") && !text.includes("billing/db")) {
    missing.push("DATABASE_URL billing db module");
  }
  if (
    !text.includes("session.ts") &&
    !content.includes("getuseridfromrequest")
  ) {
    missing.push("auth session linked to checkout");
  }
  if (
    !content.includes("requirepro") &&
    !content.includes("canaccessfeature")
  ) {
    missing.push("premium feature gate");
  }
  for (const [label, needle] of [
    ["billing catalog", "resolvebillingplan"],
    ["billing event idempotency ledger", "processbillingeventonce"],
    ["invoice paid/failed handling", "invoice.payment_failed"],
    ["customer portal", "billingportal.sessions.create"],
    ["refund handling", "refundpayment"],
    ["verified billing health", "verifybillinghealth"],
    ["billing audit", "auditbillingaction"],
    ["server access limits", "requirepaidaccess"],
  ] as const) {
    if (!content.includes(needle)) missing.push(label);
  }
  if (content.includes('localstorage.getitem("userid")')) {
    missing.push("checkout must not trust client user identity");
  }
  if (content.includes("vite_stripe_price_id")) {
    missing.push("checkout must not trust client price identifiers");
  }

  return { passed: missing.length === 0, missing };
}
