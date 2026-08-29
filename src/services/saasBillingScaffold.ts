/** Stripe billing scaffold merged into income-oriented builds (Fintech capability). */

import {
  billingDbModule,
  billingEntitlementsModule,
  billingExpressMeRoute,
  billingMeRoute,
  billingSchemaSql,
  billingSessionModule,
  billingSetupReadme,
  billingSubscriptionsModule,
  billingWebhookHandlers,
  requireProComponent,
} from "../lib/billingScaffoldTemplates.js";

type Files = Record<string, string>;

export const BILLING_REQUIRED_PATHS = [
  "billing/stripe-manifest.json",
  "src/lib/billing/db.ts",
  "src/lib/billing/subscriptions.ts",
  "src/lib/billing/entitlements.ts",
  "database/billing-schema.sql",
] as const;

export function billingScaffoldFiles(techStack: string): Files {
  const isNext = techStack.includes("next");
  const webhooks = billingWebhookHandlers(isNext);

  const checkoutRoute = isNext
    ? `import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "../../../lib/auth/session.js";

export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY not configured" }, { status: 503 });
  }
  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
  const body = (await req.json()) as {
    priceId?: string;
    customerEmail?: string;
    userId?: string;
  };
  const sessionUserId = getUserIdFromRequest(req) ?? body.userId;
  const priceId = body.priceId ?? process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    return NextResponse.json({ error: "Missing priceId" }, { status: 400 });
  }
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: \`\${process.env.APP_URL ?? "http://localhost:3000"}/billing/success?session_id={CHECKOUT_SESSION_ID}\`,
    cancel_url: \`\${process.env.APP_URL ?? "http://localhost:3000"}/pricing\`,
    customer_email: body.customerEmail,
    client_reference_id: sessionUserId ?? body.customerEmail,
    metadata: sessionUserId ? { userId: sessionUserId } : undefined,
  });
  return NextResponse.json({ url: session.url });
}
`
    : `import type { Request, Response } from "express";
import { getUserIdFromRequest } from "../../lib/auth/session.js";

export async function createCheckoutSession(req: Request, res: Response) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    res.status(503).json({ error: "STRIPE_SECRET_KEY not configured" });
    return;
  }
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
  const { priceId, customerEmail, userId } = req.body as {
    priceId?: string;
    customerEmail?: string;
    userId?: string;
  };
  const resolvedPrice = priceId ?? process.env.STRIPE_PRICE_ID;
  if (!resolvedPrice) {
    res.status(400).json({ error: "Missing priceId" });
    return;
  }
  const sessionUserId = getUserIdFromRequest(req) ?? userId;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: resolvedPrice, quantity: 1 }],
    success_url: \`\${process.env.APP_URL ?? "http://localhost:5173"}/billing/success?session_id={CHECKOUT_SESSION_ID}\`,
    cancel_url: \`\${process.env.APP_URL ?? "http://localhost:5173"}/pricing\`,
    customer_email: customerEmail,
    client_reference_id: sessionUserId ?? customerEmail,
    metadata: sessionUserId ? { userId: sessionUserId } : undefined,
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
        ],
        testCard: "4242 4242 4242 4242",
        migration: "database/billing-schema.sql",
      },
      null,
      2,
    ),
    "billing/SETUP.md": billingSetupReadme(isNext),
    "src/lib/billing/db.ts": billingDbModule(),
    "src/lib/billing/subscriptions.ts": billingSubscriptionsModule(),
    "src/lib/billing/entitlements.ts": billingEntitlementsModule(),
    "src/lib/auth/session.ts": billingSessionModule(),
    "src/components/RequirePro.tsx": requireProComponent(),
    "database/billing-schema.sql": billingSchemaSql(),
    ...(isNext
      ? {
          "src/app/api/checkout/route.ts": checkoutRoute,
          "src/app/api/webhooks/stripe/route.ts": webhooks.nextRoute,
          ...(billingMeRoute(isNext)
            ? { "src/app/api/billing/me/route.ts": billingMeRoute(isNext)! }
            : {}),
        }
      : {
          "src/server/routes/billing/checkout.ts": checkoutRoute,
          "src/server/routes/billing/webhook.ts": webhooks.expressRoute,
          "src/server/routes/billing/me.ts": billingExpressMeRoute(),
        }),
    "src/pages/PricingPage.tsx": `import { useState } from "react";

export function PricingPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(priceId?: string) {
    setLoading(true);
    setError(null);
    try {
      const endpoint = ${isNext ? '"/api/checkout"' : '"/api/billing/checkout"'};
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId: priceId ?? import.meta.env.VITE_STRIPE_PRICE_ID,
          customerEmail: localStorage.getItem("userEmail") ?? undefined,
          userId: localStorage.getItem("userId") ?? undefined,
        }),
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
      <h1>Subscription active</h1>
      <p>Your payment succeeded. Pro features unlock after the webhook updates your account.</p>
    </main>
  );
}
`,
  };
}

export function mergeBillingScaffold(
  files: Files,
  techStack: string,
  fintechSchemaJson?: string,
): Files {
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

  return { passed: missing.length === 0, missing };
}
