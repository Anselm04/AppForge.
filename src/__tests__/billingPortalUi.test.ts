import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pricing = readFileSync(
  resolve(process.cwd(), "src/pages/Pricing.tsx"),
  "utf8",
);

describe("Stripe billing portal UI", () => {
  it("lets existing Stripe customers manage their subscription", () => {
    expect(pricing).toContain("trpc.subscriptions.billingPortal.mutate()");
    expect(pricing).toContain("subStatus?.stripeCustomerId");
    expect(pricing).toContain("Manage billing & subscription");
  });
});
