import { test, expect } from "vitest";

/**
 * Golden-path smoke tests (mock-friendly).
 * Full Playwright E2E runs in CI when PLAYWRIGHT_E2E=1.
 */
test("home route module exports", async () => {
  const mod = await import("../pages/Home.js");
  expect(mod).toBeDefined();
});

test("build pipeline exports runAgentPipeline", async () => {
  const mod = await import("../agents/pipeline.js");
  expect(typeof mod.runAgentPipeline).toBe("function");
});

test("deploy health detects env vars", async () => {
  const { detectRequiredEnvVars } = await import("../services/deployHealth.js");
  const vars = detectRequiredEnvVars({
    "src/db.ts": "const url = process.env.DATABASE_URL;",
  });
  expect(vars).toContain("DATABASE_URL");
});

test("build capabilities registry", async () => {
  const { BUILD_CAPABILITIES, BUILD_CAPABILITY_IDS } =
    await import("../lib/buildCapabilities.js");
  expect(BUILD_CAPABILITY_IDS).toHaveLength(19);
  expect(BUILD_CAPABILITIES.patent.label.toLowerCase()).toContain("patent");
  expect(BUILD_CAPABILITIES.architecture.label.toLowerCase()).toContain(
    "architecture",
  );
});

test("billing golden path validator on scaffold", async () => {
  const { mergeBillingScaffold } =
    await import("../services/saasBillingScaffold.js");
  const { validateBillingGoldenPath } =
    await import("../services/billingE2eValidator.js");
  const files = mergeBillingScaffold({}, "next-node");
  const report = validateBillingGoldenPath(files);
  expect(report.checks.some((c) => c.id === "webhook_db" && c.passed)).toBe(
    true,
  );
});

test("patent reference numeral check", async () => {
  const { checkReferenceNumerals } =
    await import("../lib/patentReferenceCheck.js");
  const r = checkReferenceNumerals(
    "The housing 10 connects to the motor 20.",
    "FIG 1 shows housing 10 and motor 20",
  );
  expect(r.matched).toContain("10");
  expect(r.matched).toContain("20");
});
