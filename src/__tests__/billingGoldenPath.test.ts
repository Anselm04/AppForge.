import { describe, expect, it } from "vitest";
import {
  billingScaffoldFiles,
  mergeBillingScaffold,
  validateBillingScaffold,
} from "../services/saasBillingScaffold.js";
import {
  databaseSetupGuide,
  detectDbProvider,
  hasBillingMigration,
} from "../services/databaseProvision.js";
import { scanProjectReadiness } from "../lib/revenueReadiness.js";

describe("billing golden path scaffold", () => {
  it("includes webhook DB persistence and subscriptions module", () => {
    const files = billingScaffoldFiles("next-node");
    expect(files["src/lib/billing/subscriptions.ts"]).toContain(
      "upsertFromCheckoutSession",
    );
    expect(files["src/app/api/webhooks/stripe/route.ts"]).toContain(
      "upsertFromCheckoutSession",
    );
    expect(files["src/lib/billing/entitlements.ts"]).toContain(
      "getSubscriptionByUserId",
    );
    expect(files["database/billing-schema.sql"]).toContain("UNIQUE");
  });

  it("passes strengthened billing validation", () => {
    const merged = mergeBillingScaffold(
      { "package.json": '{"name":"app","dependencies":{}}' },
      "next-node",
    );
    const result = validateBillingScaffold(merged);
    expect(result.passed).toBe(true);
    expect(result.missing).toHaveLength(0);
    expect(merged["src/lib/auth/session.ts"]).toContain("getUserIdFromRequest");
    expect(merged["src/components/RequirePro.tsx"]).toContain("RequirePro");
  });

  it("scores higher readiness when persistence is present", () => {
    const merged = mergeBillingScaffold({}, "next-node");
    const scan = scanProjectReadiness(merged, { incomeIntent: true });
    const webhook = scan.items.find((i) => i.id === "stripe_webhook");
    const entitlements = scan.items.find((i) => i.id === "entitlements");
    expect(webhook?.status).toBe("done");
    expect(entitlements?.status).toBe("done");
    expect(scan.percent).toBeGreaterThan(50);
  });
});

describe("databaseProvision", () => {
  it("detects supabase stack", () => {
    expect(detectDbProvider("react-supabase")).toBe("supabase");
    expect(detectDbProvider("next-node")).toBe("neon");
  });

  it("returns Neon setup steps for next-node", () => {
    const guide = databaseSetupGuide("next-node", {
      projectName: "My SaaS",
      hasBillingSchema: true,
    });
    expect(guide.provider).toBe("neon");
    expect(guide.steps.some((s) => s.includes("Neon"))).toBe(true);
    expect(guide.migrationCommand).toContain("billing-schema.sql");
  });

  it("detects billing migration file", () => {
    expect(
      hasBillingMigration({ "database/billing-schema.sql": "CREATE TABLE" }),
    ).toBe(true);
  });
});

describe("billingE2eValidator", () => {
  it("validates full golden path on merged scaffold", async () => {
    const { validateBillingGoldenPath } =
      await import("../services/billingE2eValidator.js");
    const { mergeBillingScaffold } =
      await import("../services/saasBillingScaffold.js");
    const merged = mergeBillingScaffold({}, "next-node");
    const report = validateBillingGoldenPath(merged);
    expect(report.passed).toBe(true);
    expect(report.checks.length).toBeGreaterThanOrEqual(6);
  });
});
