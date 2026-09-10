import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const router = readFileSync(
  resolve(process.cwd(), "src/routers/subscriptions.ts"),
  "utf8",
);
const pricing = readFileSync(
  resolve(process.cwd(), "src/pages/Pricing.tsx"),
  "utf8",
);

describe("duplicate subscription protection", () => {
  it("rejects a second checkout for an active or trialing Stripe subscription", () => {
    expect(router).toContain('existing.status === "active"');
    expect(router).toContain('existing.status === "trialing"');
    expect(router).toContain('code: "CONFLICT"');
    expect(router).toContain("without creating a second subscription");
  });

  it("routes plan changes for existing customers through the billing portal", () => {
    expect(pricing).toContain("hasManagedSubscription");
    expect(pricing).toContain("manageBilling.mutate()");
  });
});
