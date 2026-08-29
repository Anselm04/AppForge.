/** Stripe billing scaffold merged into income-oriented builds (Fintech capability). */

type Files = Record<string, string>;

export const BILLING_REQUIRED_PATHS = [
  "billing/stripe-manifest.json",
  "src/server/routes/billing/checkout.ts",
  "src/server/routes/billing/webhook.ts",
  "src/lib/billing/entitlements.ts",
  "src/pages/PricingPage.tsx",
] as const;

export function billingScaffoldFiles(techStack: string): Files {
  const isNext = techStack.includes("next");
  const checkoutRoute = isNext
    ? `// filename: src/app/api/checkout/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY not configured" }, { status: 503 });
  }
  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
  const body = (await req.json()) as { priceId?: string; customerEmail?: string };
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
  });
  return NextResponse.json({ url: session.url });
}
`
    : `// filename: src/server/routes/billing/checkout.ts
import type { Request, Response } from "express";

export async function createCheckoutSession(req: Request, res: Response) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    res.status(503).json({ error: "STRIPE_SECRET_KEY not configured" });
    return;
  }
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
  const { priceId, customerEmail } = req.body as { priceId?: string; customerEmail?: string };
  const resolvedPrice = priceId ?? process.env.STRIPE_PRICE_ID;
  if (!resolvedPrice) {
    res.status(400).json({ error: "Missing priceId" });
    return;
  }
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: resolvedPrice, quantity: 1 }],
    success_url: \`\${process.env.APP_URL ?? "http://localhost:5173"}/billing/success?session_id={CHECKOUT_SESSION_ID}\`,
    cancel_url: \`\${process.env.APP_URL ?? "http://localhost:5173"}/pricing\`,
    customer_email: customerEmail,
  });
  res.json({ url: session.url });
}
`;

  const webhookRoute = isNext
    ? `// filename: src/app/api/webhooks/stripe/route.ts
import { NextResponse } from "next/server";

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
  // TODO: persist subscription status to your database (see src/lib/billing/entitlements.ts)
  if (event.type === "checkout.session.completed") {
    console.log("[stripe] checkout completed", event.id);
  }
  return NextResponse.json({ received: true });
}
`
    : `// filename: src/server/routes/billing/webhook.ts
import type { Request, Response } from "express";

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
  if (event.type === "checkout.session.completed") {
    console.log("[stripe] checkout completed", event.id);
  }
  res.json({ received: true });
}
`;

  return {
    "billing/stripe-manifest.json": JSON.stringify(
      {
        provider: "stripe",
        mode: "subscription",
        requiredEnv: [
          "STRIPE_SECRET_KEY",
          "STRIPE_WEBHOOK_SECRET",
          "STRIPE_PRICE_ID",
          "APP_URL",
        ],
        clientEnv: ["VITE_STRIPE_PUBLISHABLE_KEY"],
        webhookEvents: [
          "checkout.session.completed",
          "customer.subscription.updated",
          "invoice.paid",
        ],
        testCard: "4242 4242 4242 4242",
      },
      null,
      2,
    ),
    ...(isNext
      ? {
          "src/app/api/checkout/route.ts": checkoutRoute.replace(
            /^\/\/ filename:.*\n/,
            "",
          ),
          "src/app/api/webhooks/stripe/route.ts": webhookRoute.replace(
            /^\/\/ filename:.*\n/,
            "",
          ),
        }
      : {
          "src/server/routes/billing/checkout.ts": checkoutRoute.replace(
            /^\/\/ filename:.*\n/,
            "",
          ),
          "src/server/routes/billing/webhook.ts": webhookRoute.replace(
            /^\/\/ filename:.*\n/,
            "",
          ),
        }),
    "src/lib/billing/entitlements.ts": `// filename: src/lib/billing/entitlements.ts
export type Plan = "free" | "pro" | "enterprise";

export type UserEntitlements = {
  plan: Plan;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  activeUntil?: string;
};

/** Replace with DB lookup — stub for generated apps. */
export async function getEntitlements(userId: string): Promise<UserEntitlements> {
  void userId;
  return { plan: "free" };
}

export function canAccessFeature(entitlements: UserEntitlements, feature: string): boolean {
  if (entitlements.plan === "enterprise") return true;
  if (entitlements.plan === "pro") return feature !== "enterprise_only";
  return feature === "free";
}
`,
    "src/pages/PricingPage.tsx": `// filename: src/pages/PricingPage.tsx
import { useState } from "react";

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
        body: JSON.stringify({ priceId: priceId ?? import.meta.env.VITE_STRIPE_PRICE_ID }),
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
    "database/billing-schema.sql": `-- Subscriptions table — run against your production DB
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  plan VARCHAR(50) DEFAULT 'free',
  status VARCHAR(50) DEFAULT 'inactive',
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
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
  if (!text.includes("entitlement") && !content.includes("subscription")) {
    missing.push("entitlements helper");
  }
  if (!content.includes("stripe")) {
    missing.push("stripe dependency or integration");
  }

  return { passed: missing.length === 0, missing };
}
