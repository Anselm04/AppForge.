import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const copy = JSON.parse(
  readFileSync(resolve(process.cwd(), "src/i18n/data/en.json"), "utf8"),
).pricing as Record<string, string>;
const database = readFileSync(resolve(process.cwd(), "src/db.ts"), "utf8");

const pricing = readFileSync(
  resolve(process.cwd(), "src/pages/Pricing.tsx"),
  "utf8",
);
const subscriptions = readFileSync(
  resolve(process.cwd(), "src/routers/subscriptions.ts"),
  "utf8",
);

describe("Enterprise sales-led provisioning", () => {
  it("does not advertise unlimited paid Enterprise credits or unlimited Studio compute", () => {
    expect(copy.enterpriseF1.toLowerCase()).toContain("not unlimited");
    expect(copy.studioF1.toLowerCase()).toContain("metered budget");
    expect(database).toContain("enterprise: null");
    expect(database).toContain("unlimited: owner");
  });

  it("discloses USD pricing and contract-based Enterprise allowances", () => {
    expect(pricing).toContain("All amounts are in USD");
    expect(pricing).toContain("not unlimited builds");
  });
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
