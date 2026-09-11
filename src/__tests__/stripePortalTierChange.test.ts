import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webhook = readFileSync(
  resolve(process.cwd(), "src/webhooks/stripe.ts"),
  "utf8",
);

describe("Stripe portal plan changes", () => {
  it("uses the verified Stripe price as the entitlement source of truth", () => {
    expect(webhook).toContain("if (mappedTier)");
    expect(webhook).toContain("return mappedTier");
    expect(webhook).toContain("stripe_tier_metadata_stale_using_price");
    expect(webhook).not.toContain("Stripe tier metadata mismatch");
  });
});
