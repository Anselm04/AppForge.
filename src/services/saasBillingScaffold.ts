/** Stripe billing scaffold merged into income-oriented builds (Fintech capability). */

import {
  billingDbModule,
  billingEntitlementsModule,
  billingExpressMeRoute,
  billingMeRoute,
  billingSchemaSql,
  billingSetupReadme,
  billingSubscriptionsModule,
  billingWebhookHandlers,
  requireProComponent,
} from "../lib/billingScaffoldTemplates.js";
import { secureBillingSessionModule } from "../lib/secureBillingSessionTemplate.js";

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
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!stripeKey || !priceId) {
    return NextResponse.json({ error: "Billing is not configured" }, { status: 503 });
  }
  const sessionUserId = getUserIdFromRequest(req);
  if (!sessionUserId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    return NextResponse.json({ error: "APP_URL not configured" }, { status: 503 });
  }
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: \`\${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}\`,
    cancel_url: \`\${appUrl}/pricing\`,
    client_reference_id: sessionUserId,
    metadata: { userId: sessionUserId },
    subscription_data: { metadata: { userId: sessionUserId } },
  });
  return NextResponse.json({ url: session.url });
}
`
    : `import type { Request, Response } from "express";
import { getUserIdFromRequest } from "../../lib/auth/session.js";

export async function createCheckoutSession(req: Request, res: Response) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!stripeKey || !priceId) {
    res.status(503).json({ error: "Billing is not configured" });
    return;
  }
  const sessionUserId = getUserIdFromRequest(req);
  if (!sessionUserId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    res.status(503).json({ error: "APP_URL not configured" });
    return;
  }
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: \`\${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}\`,
    cancel_url: \`\${appUrl}/pricing\`,
    client_reference_id: sessionUserId,
    metadata: { userId: sessionUserId },
    subscription_data: { metadata: { userId: sessionUserId } },
  });
  res.json({ url: session.url });
}
`;

  const securitySetup = `

## Required authentication integration

- Set \`SESSION_SECRET\` to a cryptographically random value of at least 32 characters.
- The generated billing session cookie is HMAC-signed, HttpOnly, Secure, and SameSite=Lax.
- Only call \`createSignedUserSessionCookie(userId)\` after your server has verified the user through your real authentication provider (for example Supabase Auth, Clerk, or Auth.js).
- Never accept a billing user ID, Stripe price ID, customer email, success URL, or cancel URL from browser input as authority.
- Checkout fails closed unless the signed user session, \`STRIPE_PRICE_ID\`, \`STRIPE_SECRET_KEY\`, and \`APP_URL\` are configured.
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
          "SESSION_SECRET",
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
    "billing/SETUP.md": billingSetupReadme(isNext) + securitySetup,
    "src/lib/billing/db.ts": billingDbModule(),
    "src/lib/billing/subscriptions.ts": billingSubscriptionsModule(),
    "src/lib/billing/entitlements.ts": billingEntitlementsModule(),
    "src/lib/auth/session.ts": secureBillingSessionModule(),
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

  async function startCheckout() {
    setLoading(true);
    setError(null);
    try {
      const endpoint = ${isNext ? '"/api/checkout"' : '"/api/billing/checkout"'};
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
  const checkoutContent = Object.entries(files)
    .filter(([path]) => path.toLowerCase().includes("checkout"))
    .map(([, value]) => value)
    .join("\n")
    .toLowerCase();
  const pricingContent = (files["src/pages/PricingPage.tsx"] ?? "").toLowerCase();
  const sessionContent = (files["src/lib/auth/session.ts"] ?? "").toLowerCase();

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
    !sessionContent.includes("createhmac") ||
    !sessionContent.includes("timingsafeequal") ||
    !sessionContent.includes("session_secret")
  ) {
    missing.push("cryptographically verified billing session");
  }
  if (
    !checkoutContent.includes("process.env.stripe_price_id") ||
    checkoutContent.includes("body.priceid") ||
    checkoutContent.includes("req.body") && checkoutContent.includes("priceid")
  ) {
    missing.push("server-owned Stripe price");
  }
  if (
    checkoutContent.includes("body.userid") ||
    checkoutContent.includes("customeremail") ||
    pricingContent.includes("vite_stripe_price_id") ||
    pricingContent.includes("localstorage.getitem(\"userid\")") ||
    pricingContent.includes("localstorage.getitem(\"useremail\")")
  ) {
    missing.push("server-owned billing identity");
  }
  if (!checkoutContent.includes("not authenticated") || !checkoutContent.includes("401")) {
    missing.push("checkout fails closed for unauthenticated users");
  }
  if (
    !content.includes("requirepro") &&
    !content.includes("canaccessfeature")
  ) {
    missing.push("premium feature gate");
  }

  return { passed: missing.length === 0, missing };
}
