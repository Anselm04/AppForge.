import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const service = readFileSync(
  resolve(process.cwd(), "src/services/stripeBillingPortal.ts"),
  "utf8",
);
const router = readFileSync(
  resolve(process.cwd(), "src/routers/subscriptions.ts"),
  "utf8",
);

describe("managed Stripe billing portal", () => {
  it("reuses an AppForge-managed active portal configuration", () => {
    expect(service).toContain("stripe.billingPortal.configurations.list");
    expect(service).toContain("appforge_managed_portal");
    expect(service).toContain("if (existing) return existing.id");
  });

  it("derives allowed subscription products from configured Stripe prices", () => {
    expect(service).toContain("stripe.prices.retrieve(priceId)");
    expect(service).toContain("STRIPE_STARTER_PRICE_ID");
    expect(service).toContain("STRIPE_BUILDER_PRICE_ID");
    expect(service).toContain("STRIPE_STUDIO_PRICE_ID");
    expect(service).toContain('default_allowed_updates: ["price"]');
    expect(service).toContain('mode: "at_period_end"');
  });

  it("creates portal sessions with the managed configuration explicitly", () => {
    expect(router).toContain("ensureAppForgeBillingPortalConfiguration");
    expect(router).toContain("configuration,");
    expect(router).toContain("stripe.billingPortal.sessions.create");
  });
});
