import { describe, expect, it } from "vitest";
import {
  detectIncomeIntent,
  scanProjectReadiness,
  suggestCapabilitiesForIncome,
  revenueGoLiveSteps,
  INCOME_PRODUCT_CHECKLIST,
} from "../lib/revenueReadiness.js";
import {
  billingScaffoldFiles,
  mergeBillingScaffold,
  validateBillingScaffold,
} from "../services/saasBillingScaffold.js";

describe("revenueReadiness", () => {
  it("detects income intent from keywords", () => {
    expect(detectIncomeIntent("Build a SaaS with Stripe subscriptions")).toBe(
      true,
    );
    expect(detectIncomeIntent("A simple todo app")).toBe(false);
  });

  it("suggests fintech and marketing capabilities", () => {
    const caps = suggestCapabilitiesForIncome(["web_search"]);
    expect(caps).toContain("fintech");
    expect(caps).toContain("marketing");
  });

  it("scores project files against checklist", () => {
    const merged = mergeBillingScaffold({}, "next-node");
    const scan = scanProjectReadiness(merged, { incomeIntent: true });
    expect(scan.percent).toBeGreaterThan(40);
    expect(scan.items.length).toBe(INCOME_PRODUCT_CHECKLIST.length);
    expect(scan.stripeDetected).toBe(true);
  });

  it("returns Stripe go-live steps with deploy URL", () => {
    const steps = revenueGoLiveSteps("https://myapp.example.com/");
    expect(steps.some((s) => s.includes("myapp.example.com"))).toBe(true);
    expect(steps.some((s) => s.includes("4242"))).toBe(true);
  });
});

describe("saasBillingScaffold", () => {
  it("generates Next.js billing routes", () => {
    const files = billingScaffoldFiles("next-node");
    expect(files["src/app/api/checkout/route.ts"]).toContain(
      "checkout.sessions.create",
    );
    expect(files["src/app/api/webhooks/stripe/route.ts"]).toContain("webhook");
    expect(files["billing/stripe-manifest.json"]).toContain(
      "STRIPE_SECRET_KEY",
    );
  });

  it("generates server-owned billing identity and pricing", () => {
    for (const techStack of ["next-node", "react-node"]) {
      const files = billingScaffoldFiles(techStack);
      const checkoutPath = techStack.includes("next")
        ? "src/app/api/checkout/route.ts"
        : "src/server/routes/billing/checkout.ts";
      const checkout = files[checkoutPath] ?? "";
      const pricing = files["src/pages/PricingPage.tsx"] ?? "";
      const session = files["src/lib/auth/session.ts"] ?? "";

      expect(checkout).toContain("process.env.STRIPE_PRICE_ID");
      expect(checkout).toContain("getUserIdFromRequest");
      expect(checkout).toContain("Not authenticated");
      expect(checkout).not.toContain("body.priceId");
      expect(checkout).not.toContain("body.userId");
      expect(checkout).not.toContain("customerEmail");
      expect(pricing).not.toContain("VITE_STRIPE_PRICE_ID");
      expect(pricing).not.toContain("localStorage.getItem");
      expect(session).toContain("createHmac");
      expect(session).toContain("timingSafeEqual");
      expect(session).toContain("SESSION_SECRET");
      expect(validateBillingScaffold(files).passed).toBe(true);
    }
  });

  it("merges scaffold and adds stripe dependency", () => {
    const merged = mergeBillingScaffold(
      { "package.json": '{"name":"app","dependencies":{}}' },
      "react-node",
    );
    const pkg = JSON.parse(merged["package.json"]!) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies.stripe).toBeDefined();
    expect(pkg.dependencies.postgres).toBeDefined();
    expect(validateBillingScaffold(merged).passed).toBe(true);
  });
});
