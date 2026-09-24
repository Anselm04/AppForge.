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
  const pipeline = readFileSync("src/agents/pipeline.generated.ts", "utf8");
  const testingAgent = readFileSync("src/agents/testingAgent.ts", "utf8");
  const canary = readFileSync("scripts/production-customer-canary.mjs", "utf8");

  expect(pipeline).toContain(
    'const testsBlocking = validationMode === "full";',
  );
  expect(pipeline).toContain('testGateRequired: validationMode === "full"');
  expect(pipeline).toContain("generatedTestFileCount:");
  expect(testingAgent).toContain('scripts.test = scripts.test ?? "vitest run"');
  // Every stack's harness installs vitest; only React stacks get RTL.
  expect(testingAgent).toContain("HARNESS_DEV_DEPENDENCIES[harness]");
  expect(testingAgent).toContain('node: { vitest: "^3.2.7" }');
  expect(testingAgent).toContain('"@testing-library/react": "^14.2.0"');
  expect(canary).toContain("done.validationPassed !== true");
  expect(canary).toContain("done.testGateRequired !== true");
  expect(canary).toContain("done.generatedTestFileCount > 0");
});

test("generated full-validation test harness installs its own dependencies", async () => {
  const { attachGeneratedTests } = await import("../agents/testingAgent.js");
  const files: Record<string, string> = {
    "package.json": JSON.stringify({
      name: "generated-canary",
      scripts: [],
      dependencies: {},
      devDependencies: [],
    }),
    "index.html": '<div id="root"></div>',
  };

  const tests = await attachGeneratedTests(files, "react-node");
  const pkg = JSON.parse(files["package.json"]);

  expect(tests["vitest.config.ts"]).toBeTruthy();
  expect(tests["src/__tests__/setup.ts"]).toBeTruthy();
  expect(pkg.scripts.test).toBe("vitest run");
  expect(pkg.devDependencies.vite).toBe("^5.4.21");
  expect(pkg.devDependencies["@vitejs/plugin-react"]).toBe("^4.2.1");
  expect(pkg.devDependencies.vitest).toBeTruthy();
  expect(pkg.devDependencies.jsdom).toBeTruthy();
  expect(pkg.devDependencies["@testing-library/react"]).toBeTruthy();
  expect(pkg.devDependencies["@testing-library/jest-dom"]).toBeTruthy();
});
