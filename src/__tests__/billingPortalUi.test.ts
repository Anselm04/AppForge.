import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pricing = readFileSync(
  resolve(process.cwd(), "src/pages/Pricing.tsx"),
  "utf8",
);
const subscriptions = readFileSync(
  resolve(process.cwd(), "src/routers/subscriptions.ts"),
  "utf8",
);

describe("Stripe billing portal UI", () => {
  it("lets existing Stripe customers manage their subscription", () => {
    expect(pricing).toContain("trpc.subscriptions.billingPortal.mutate()");
    expect(pricing).toContain("subStatus?.stripeCustomerId");
    expect(pricing).toContain("Manage billing & subscription");
  });

  it("requires the configured public app URL for billing portal redirects", () => {
    expect(subscriptions).toContain(
      "PUBLIC_APP_URL is required for billing portal redirects",
    );
    expect(subscriptions).toContain(
      "PUBLIC_APP_URL must be a valid absolute URL",
    );
    expect(subscriptions).toContain(
      "PUBLIC_APP_URL must use HTTPS in production",
    );
    expect(subscriptions).not.toContain("appforge-unfurling-moon-9058.fly.dev");
  });
});
