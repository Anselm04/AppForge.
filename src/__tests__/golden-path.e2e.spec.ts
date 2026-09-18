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
  expect(pipeline).toContain("requirementTraceRequired: testsBlocking");
  expect(pipeline).toContain("requireIsolation: testsBlocking");
  expect(pipeline).toContain("deployValidatedProject");
  expect(pipeline).toContain("isolatedProductionBuildVerified");
  expect(pipeline).toContain("liveDeploymentVerified");
  expect(testingAgent).toContain("APPFORGE_REQUIREMENT:REQ-001");
  expect(testingAgent).toContain("_appforge/requirements.json");
  expect(testingAgent).toContain(
    'scripts.test = scripts.test ?? "vitest run"',
  );
  expect(testingAgent).toContain("devDependencies.vitest");
  expect(testingAgent).toContain(
    'devDependencies["@testing-library/react"]',
  );
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

test("requirement manifest links customer intent to behavioral test", async () => {
  const { createRequirementManifest } =
    await import("../agents/testingAgent.js");
  const manifest = JSON.parse(
    createRequirementManifest(
      "Show a counter that increments when the customer clicks the button.",
    ),
  );

  expect(manifest.source).toBe("customer_description");
  expect(manifest.requirements).toEqual([
    expect.objectContaining({
      id: "REQ-001",
      text: expect.stringContaining("counter"),
      behavioralTest: "src/__tests__/requirements.behavior.test.tsx",
    }),
  ]);
});

test("production certification uses isolated Fly remote build plus live browser verification", async () => {
  const { readFileSync } = await import("node:fs");
  const deployer = readFileSync("src/services/deployer.ts", "utf8");
  const production = readFileSync(
    "src/services/productionAutoDeploy.ts",
    "utf8",
  );

  expect(deployer).toContain('"deploy", "--remote-only"');
  expect(production).toContain("npm test; fi");
  expect(production).toContain(
    'prepared["Dockerfile"] = productionDockerfile',
  );
  expect(production).toContain("runPostDeploySmokeTest(liveUrl)");
  expect(production).toContain("verifyGeneratedAppInBrowser(liveUrl)");
  expect(production).toContain(
    "Production deployment failed real browser verification",
  );
});

test("requirement trace gate fails before build when evidence is missing", async () => {
  const { validateGeneratedBuild } =
    await import("../agents/buildValidator.js");

  const result = await validateGeneratedBuild(
    {
      "package.json": JSON.stringify({
        name: "missing-requirement-evidence",
        scripts: { build: "vite build" },
      }),
    },
    "react-node",
    { requirementTraceRequired: true },
  );

  expect(result.passed).toBe(false);
  expect(result.stage).toBe("requirements");
  expect(result.errors.join(" ")).toContain("Requirement trace gate failed");
});

test("certification Dockerfile cannot be bypassed by generated Dockerfile", async () => {
  const { prepareProductionFiles } =
    await import("../services/productionAutoDeploy.js");
  const prepared = prepareProductionFiles({
    "package.json": JSON.stringify({
      scripts: {
        test: "vitest run",
        build: "vite build",
      },
    }),
    Dockerfile: "FROM scratch\n",
  });

  expect(prepared.Dockerfile).not.toBe("FROM scratch\n");
  expect(prepared.Dockerfile).toContain("then npm test; fi");
  expect(prepared.Dockerfile).toContain("RUN npm run build");
});

test("generated validation rejects paths that escape the workspace", async () => {
  const { validateGeneratedBuild } =
    await import("../agents/buildValidator.js");
  const result = await validateGeneratedBuild(
    {
      "../escape.ts": "export const escaped = true;",
      "package.json": JSON.stringify({ name: "unsafe-path" }),
    },
    "react-node",
  );

  expect(result.passed).toBe(false);
  expect(result.stage).toBe("structure");
  expect(result.errors.join(" ")).toContain(
    "Unsafe generated file path rejected",
  );
});
