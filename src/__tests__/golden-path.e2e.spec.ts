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

test("stack metadata returns tier", async () => {
  const { getStackMeta } = await import("../lib/stackMetadata.js");
  const meta = getStackMeta("react-node");
  expect(meta.tier).toBe("full");
});
