import { test, expect } from "vitest";

/**
 * Golden-path contract tests.
 * These protect the critical customer path in CI. Production browser proof is
 * still required separately, but this suite must fail when a core handoff is
 * accidentally disconnected.
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

test("production deployment gate rejects a missing live product", async () => {
  const { isSuccessfulDeployStatus } =
    await import("../services/deployHealth.js");
  expect(isSuccessfulDeployStatus(200)).toBe(true);
  expect(isSuccessfulDeployStatus(302)).toBe(true);
  expect(isSuccessfulDeployStatus(401)).toBe(false);
  expect(isSuccessfulDeployStatus(403)).toBe(false);
  expect(isSuccessfulDeployStatus(404)).toBe(false);
  expect(isSuccessfulDeployStatus(503)).toBe(false);
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


test("production proof requires generated tests before deploy certification", async () => {
  const { readFileSync } = await import("node:fs");
  const pipeline = readFileSync(
    new URL("../agents/pipeline.generated.ts", import.meta.url),
    "utf8",
  );
  const testingAgent = readFileSync(
    new URL("../agents/testingAgent.ts", import.meta.url),
    "utf8",
  );
  const canary = readFileSync(
    new URL("../../scripts/production-customer-canary.mjs", import.meta.url),
    "utf8",
  );

  expect(pipeline).toContain('const testsBlocking = validationMode === "full";');
  expect(pipeline).toContain('testGateRequired: validationMode === "full"');
  expect(pipeline).toContain("generatedTestFileCount:");
  expect(testingAgent).toContain('pkg.scripts.test = pkg.scripts.test ?? "vitest run"');
  expect(testingAgent).toContain('pkg.devDependencies.vitest');
  expect(testingAgent).toContain('pkg.devDependencies["@testing-library/react"]');
  expect(canary).toContain("done.validationPassed !== true");
  expect(canary).toContain("done.testGateRequired !== true");
  expect(canary).toContain("done.generatedTestFileCount > 0");
});
