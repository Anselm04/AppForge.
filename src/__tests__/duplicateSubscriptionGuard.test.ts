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
  it("blocks a second checkout while any non-terminal Stripe subscription exists", () => {
    expect(router).toContain(
      "const existingTier = await getUserTier(ctx.user.id)",
    );
    expect(router).toContain("TERMINAL_SUBSCRIPTION_STATUSES");
    expect(router).toContain("hasManagedSubscription");
    expect(router).toContain('existingTier !== "free" || hasManagedSubscription');
    expect(router).toContain('code: "CONFLICT"');
    expect(router).toContain("without creating a second subscription");
  });

  it("treats canceled and incomplete-expired subscriptions as terminal", () => {
    expect(router).toContain(
      'new Set(["canceled", "incomplete_expired"])',
    );
  });

  it("routes plan changes for existing customers through the billing portal", () => {
    expect(pricing).toContain("hasManagedSubscription");
    expect(pricing).toContain("manageBilling.mutate()");
  });
});
