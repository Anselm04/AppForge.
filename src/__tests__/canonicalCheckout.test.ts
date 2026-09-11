import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("canonical Stripe checkout boundary", () => {
  it("keeps Stripe Checkout session creation in one production service", () => {
    const canonical = source("src/services/stripeCheckout.ts");
    const route = source("src/routes/checkout.ts");
    const subscriptions = source("src/routers/subscriptions.ts");

    expect(canonical).toContain("stripe.checkout.sessions.create");
    expect(route).not.toContain("stripe.checkout.sessions.create");
    expect(subscriptions).not.toContain("stripe.checkout.sessions.create");
    expect(existsSync(resolve(process.cwd(), "api/checkout.js"))).toBe(false);
  });

  it("enforces duplicate-subscription protection inside the checkout service", () => {
    const canonical = source("src/services/stripeCheckout.ts");

    expect(canonical).toContain("assertCanCreateSubscription(sub)");
    expect(canonical).toContain("TERMINAL_SUBSCRIPTION_STATUSES");
    expect(canonical).toContain("hasManagedSubscription");
    expect(canonical).toContain("hasActivePaidEntitlement");
  });

  it("does not ship hard-coded live Stripe price IDs in the checkout service", () => {
    const canonical = source("src/services/stripeCheckout.ts");
    expect(canonical).not.toMatch(/price_[A-Za-z0-9]{8,}/);
  });

  it("keeps Enterprise out of self-serve plan checkout", () => {
    const canonical = source("src/services/stripeCheckout.ts");
    const subscriptions = source("src/routers/subscriptions.ts");

    expect(canonical).toContain(
      'SELF_SERVE_PLAN_TIERS = ["starter", "builder", "studio"]',
    );
    expect(subscriptions).toContain('if (input.tier === "enterprise")');
  });
});
