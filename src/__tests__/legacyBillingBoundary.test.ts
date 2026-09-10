import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/routes/legacyCompat.ts"),
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
