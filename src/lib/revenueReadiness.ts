import type { BuildCapabilityId } from "./buildCapabilities.js";

/** What separates a demo scaffold from a product that can earn revenue. */
export type ReadinessCategory =
  "product" | "payments" | "auth" | "data" | "deploy" | "growth" | "compliance";

export type ReadinessItem = {
  id: string;
  category: ReadinessCategory;
  label: string;
  why: string;
  /** AppForge feature or user action that addresses this */
  how: string;
};

/** Full checklist for income-generating SaaS / app products. */
export const INCOME_PRODUCT_CHECKLIST: ReadinessItem[] = [
  {
    id: "core_value",
    category: "product",
    label: "Core value loop works end-to-end",
    why: "Users must complete the main job (signup → use feature → get outcome) without broken flows.",
    how: "Full-tier stack + validation loop; manual QA on deployed preview.",
  },
  {
    id: "auth_accounts",
    category: "auth",
    label: "Accounts & sessions (signup, login, reset)",
    why: "Paid products need identifiable customers and secure access.",
    how: "Pipeline auth scaffolding; Supabase or HTTPOnly cookie auth in generated code.",
  },
  {
    id: "stripe_checkout",
    category: "payments",
    label: "Stripe Checkout or Payment Links wired to UI",
    why: "A pricing page alone does not collect money — checkout must create sessions.",
    how: "Enable Fintech capability → billing scaffold merges checkout + webhook routes.",
  },
  {
    id: "stripe_webhook",
    category: "payments",
    label: "Stripe webhooks update entitlements in your DB",
    why: "Without webhooks, payments succeed in Stripe but your app never unlocks paid features.",
    how: "billing/webhook route in scaffold; STRIPE_WEBHOOK_SECRET on host.",
  },
  {
    id: "entitlements",
    category: "payments",
    label: "Subscription / purchase entitlements enforced in app",
    why: "Gate premium routes and API by plan status, not honor system.",
    how: "src/lib/billing/entitlements.ts + middleware checks in generated app.",
  },
  {
    id: "database",
    category: "data",
    label: "Production database (not in-memory mocks)",
    why: "User data, orders, and subscriptions must persist across deploys.",
    how: "Set DATABASE_URL; run migrations; use Drizzle/Supabase from stack scaffold.",
  },
  {
    id: "env_secrets",
    category: "deploy",
    label: "Secrets on host (Stripe, DB, auth)",
    why: "Missing env vars are the #1 reason deployed apps fail silently.",
    how: "Deploy wizard env list + copy buttons; verify before go-live.",
  },
  {
    id: "domain_ssl",
    category: "deploy",
    label: "Custom domain + HTTPS",
    why: "Stripe live mode and OAuth require HTTPS; builds trust for conversions.",
    how: "Deploy to Vercel/Fly/Netlify; attach domain in host dashboard.",
  },
  {
    id: "analytics",
    category: "growth",
    label: "Conversion analytics (signup, checkout started, paid)",
    why: "You cannot optimize income without funnel metrics.",
    how: "Marketing capability + Plausible/GA4 hook placeholders; track checkout events.",
  },
  {
    id: "legal_pages",
    category: "compliance",
    label: "Terms, privacy, refund policy",
    why: "Required for Stripe, ads, and EU/UK compliance; reduces chargebacks.",
    how: "Compliance scaffold on every build; Legal studio for contract outlines.",
  },
  {
    id: "support_contact",
    category: "growth",
    label: "Support email or help page",
    why: "Paying users need a path to resolve billing issues.",
    how: "Marketing studio contact section; mailto or Intercom hook.",
  },
  {
    id: "smoke_test",
    category: "deploy",
    label: "Post-deploy smoke + test checkout (Stripe test mode)",
    why: "Confirms the deployed URL serves the app and billing routes respond.",
    how: "Deploy smoke test + run test card 4242… before switching live keys.",
  },
];

export const INCOME_INTENT_KEYWORDS = [
  "saas",
  "subscription",
  "stripe",
  "payment",
  "checkout",
  "monetize",
  "revenue",
  "income",
  "sell",
  "pricing",
  "paid",
  "marketplace",
  "mrr",
  "billing",
  "freemium",
] as const;

export function detectIncomeIntent(text: string): boolean {
  const lower = text.toLowerCase();
  return INCOME_INTENT_KEYWORDS.some((k) => lower.includes(k));
}

/** Auto-enable capabilities when user describes an income product. */
export function suggestCapabilitiesForIncome(
  existing: BuildCapabilityId[],
): BuildCapabilityId[] {
  const set = new Set<BuildCapabilityId>(existing);
  set.add("fintech");
  set.add("marketing");
  set.add("web_search");
  if (!set.has("graphics")) set.add("graphics");
  return [...set];
}

export type IncomePreset = {
  stack: string;
  capabilities: BuildCapabilityId[];
  label: string;
};

export const INCOME_READY_PRESET: IncomePreset = {
  stack: "next-node",
  label: "Income-ready SaaS",
  capabilities: ["web_search", "fintech", "marketing", "graphics", "legal"],
};

export type ReadinessScanResult = {
  score: number;
  maxScore: number;
  percent: number;
  items: Array<
    ReadinessItem & {
      status: "done" | "partial" | "missing";
      evidence?: string;
    }
  >;
  needsBillingScaffold: boolean;
  stripeDetected: boolean;
};

const BILLING_PATH_HINTS = [
  "billing/",
  "stripe",
  "checkout",
  "webhook",
  "entitlements",
  "pricing",
];

export function scanProjectReadiness(
  files: Record<string, string>,
  options?: { incomeIntent?: boolean },
): ReadinessScanResult {
  const text = Object.entries(files)
    .map(([p, c]) => `${p}\n${c}`)
    .join("\n")
    .toLowerCase();
  const paths = Object.keys(files).map((p) => p.toLowerCase());

  const hasAuth =
    text.includes("signup") ||
    text.includes("login") ||
    text.includes("supabase.auth") ||
    text.includes("session");
  const hasStripe =
    text.includes("stripe") ||
    paths.some((p) => p.includes("stripe") || p.includes("billing"));
  const hasCheckout =
    text.includes("checkout.sessions") ||
    text.includes("checkout session") ||
    text.includes("/api/checkout") ||
    text.includes("createCheckoutSession");
  const hasWebhook =
    text.includes("webhook") &&
    (text.includes("stripe") || paths.some((p) => p.includes("webhook")));
  const hasEntitlements =
    text.includes("entitlement") ||
    text.includes("subscription") ||
    paths.some((p) => p.includes("entitlement"));
  const hasDb =
    text.includes("database_url") ||
    text.includes("drizzle") ||
    text.includes("supabase") ||
    paths.some((p) => p.includes("schema") || p.includes("migration"));
  const hasLegal =
    text.includes("privacy") &&
    (text.includes("terms") || paths.some((p) => p.includes("legal")));
  const hasAnalytics =
    text.includes("plausible") ||
    text.includes("analytics") ||
    text.includes("gtag") ||
    text.includes("conversion");
  const hasHealth = text.includes("/health") || text.includes("healthcheck");
  const hasPricingUi =
    text.includes("pricing") || paths.some((p) => p.includes("pricing"));

  const checks: Record<string, "done" | "partial" | "missing"> = {
    core_value: hasHealth || paths.length > 8 ? "partial" : "missing",
    auth_accounts: hasAuth ? "done" : "missing",
    stripe_checkout: hasCheckout ? "done" : hasStripe ? "partial" : "missing",
    stripe_webhook: hasWebhook ? "done" : hasStripe ? "partial" : "missing",
    entitlements: hasEntitlements ? "done" : hasStripe ? "partial" : "missing",
    database: hasDb ? "done" : "missing",
    env_secrets: hasStripe || hasDb ? "partial" : "missing",
    domain_ssl: "missing",
    analytics: hasAnalytics ? "done" : "partial",
    legal_pages: hasLegal ? "done" : "partial",
    support_contact:
      text.includes("support@") || text.includes("contact")
        ? "partial"
        : "missing",
    smoke_test: "missing",
  };

  if (paths.some((p) => BILLING_PATH_HINTS.some((h) => p.includes(h)))) {
    if (checks.stripe_checkout === "missing")
      checks.stripe_checkout = "partial";
  }
  if (hasPricingUi && !hasCheckout) checks.stripe_checkout = "partial";

  const items = INCOME_PRODUCT_CHECKLIST.map((item) => ({
    ...item,
    status: checks[item.id] ?? "missing",
  }));

  const weights = { done: 1, partial: 0.5, missing: 0 };
  const score = items.reduce((s, i) => s + weights[i.status], 0);
  const maxScore = items.length;

  return {
    score,
    maxScore,
    percent: Math.round((score / maxScore) * 100),
    items,
    needsBillingScaffold:
      (options?.incomeIntent ?? false) &&
      (!hasCheckout || !hasWebhook || !hasEntitlements),
    stripeDetected: hasStripe,
  };
}

/** Deploy steps specific to turning on revenue after ship. */
export function revenueGoLiveSteps(deployUrl?: string | null): string[] {
  const base = deployUrl?.replace(/\/$/, "") ?? "https://your-app.example.com";
  return [
    "Create Stripe products & prices in Dashboard (test mode first).",
    "Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET on your host.",
    "Register webhook endpoint: " +
      base +
      "/api/webhooks/stripe (events: checkout.session.completed, customer.subscription.updated, invoice.paid).",
    "Set VITE_STRIPE_PUBLISHABLE_KEY (or NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) for client checkout.",
    "Run a test purchase with card 4242 4242 4242 4242; confirm entitlements unlock in app.",
    "Switch to live Stripe keys only after test funnel works end-to-end.",
    "Add refund/support policy URL linked from pricing and receipt emails.",
  ];
}

/** Gaps still needed platform-side (honest roadmap). */
export const PLATFORM_INCOME_GAPS: ReadinessItem[] = [
  {
    id: "gap_db_provision",
    category: "data",
    label: "One-click Neon/Supabase DB provisioning",
    why: "Users stall at DATABASE_URL setup.",
    how: "Future: Vercel/Supabase marketplace attach during build.",
  },
  {
    id: "gap_stripe_connect",
    category: "payments",
    label: "Stripe Connect for marketplaces",
    why: "Multi-vendor apps need Connect onboarding, not direct charges.",
    how: "Future: Connect studio + split-payment scaffold.",
  },
  {
    id: "gap_e2e_billing",
    category: "payments",
    label: "Automated test checkout in CI",
    why: "Billing regressions are costly.",
    how: "Future: Stripe test clock + Playwright checkout flow.",
  },
];
