import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/routers/subscriptions.ts"),
  "utf8",
);

describe("subscription effective tier", () => {
  it("uses active entitlement instead of stale subscription history", () => {
    expect(source).toContain("getUserTier");
    expect(source).toContain(
      "const activeSubscriptionTier = await getUserTier(ctx.user.id)",
    );
    expect(source).toContain(
      'const tier = hasLifetimeAccess ? "lifetime" : activeSubscriptionTier',
    );
    expect(source).not.toContain(
      'const tier = sub?.tier ?? credits?.tier ?? "free"',
    );
  });

  it("keeps lifetime accounts unlimited in subscription status", () => {
    expect(source).toContain('credits?.tier === "lifetime"');
    expect(source).toContain("lifetime: null");
  });
});
