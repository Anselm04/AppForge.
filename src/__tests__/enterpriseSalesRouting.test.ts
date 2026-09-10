import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const pricing = readFileSync(
  resolve(process.cwd(), "src/pages/Pricing.tsx"),
  "utf8",
);
const subscriptions = readFileSync(
  resolve(process.cwd(), "src/routers/subscriptions.ts"),
  "utf8",
);

describe("Enterprise sales-led provisioning", () => {
  it("routes the Enterprise CTA to sales instead of self-serve checkout", () => {
    expect(pricing).toContain('t("pricing.contactSales")');
    expect(pricing).toContain('tier.key === "enterprise"');
    expect(pricing).toContain("window.location.href = ENTERPRISE_CONTACT");
  });

  it("keeps the server-side self-serve checkout guard", () => {
    expect(subscriptions).toContain('input.tier === "enterprise"');
    expect(subscriptions).toContain("Enterprise plans are sales-led");
  });
});
