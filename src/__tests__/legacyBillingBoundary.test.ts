import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../routes/legacyCompat.ts", import.meta.url),
  "utf8",
);

describe("legacy billing trust boundary", () => {
  it("does not expose a second Stripe checkout path", () => {
    expect(source).not.toContain('billingCompatRouter.post("/checkout"');
    expect(source).not.toContain('billingCompatRouter.get("/checkout"');
    expect(source).not.toContain("checkout.sessions.create");
  });

  it("does not accept client-owned Stripe prices or redirect URLs", () => {
    expect(source).not.toContain("priceId");
    expect(source).not.toContain("successUrl");
    expect(source).not.toContain("cancelUrl");
  });
});
