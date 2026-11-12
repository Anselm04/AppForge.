import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assessFactoryExecution } from "../lib/factoryExecutionGate.js";

describe("single factory handoff from build to preview, evidence and export", () => {
  const worker = readFileSync("src/services/build-worker.ts", "utf8");
  const record = readFileSync("src/lib/engineeringVerification.ts", "utf8");
  const router = readFileSync("src/routers/projects.ts", "utf8");
  const legacyDeploy = readFileSync("src/routes/build.ts", "utf8");
  const healing = readFileSync("src/agents/selfHealing.ts", "utf8");
  const buildPage = readFileSync("src/pages/Build.tsx", "utf8");

  it("uses one execution gate in worker certification and evidence projector", () => {
    expect(worker).toContain("const executionDecision = assessFactoryExecution(");
    expect(worker).toContain("executionDecision.verified");
    expect(record).toContain("const execution = assessFactoryExecution(validator)");
    expect(record).toContain("execution.verified");
  });

  it("requires execution proof for previews but keeps source backup independent", () => {
    const backup = router.indexOf('if (input.destination === "zip") {');
    const preflight = router.indexOf("const execution = assessFactoryExecution(");
    const deploy = router.indexOf("const result = await deployProject({", preflight);
    expect(backup).toBeGreaterThan(0);
    expect(preflight).toBeGreaterThan(backup);
    expect(deploy).toBeGreaterThan(preflight);
    expect(router).toContain('code: "PRECONDITION_FAILED"');
    expect(legacyDeploy).toContain(
      "const execution = assessFactoryExecution(current.validationResult)",
    );
    expect(legacyDeploy).toContain('"execution_verification_required"');
    expect(healing).toContain("const repairExecution = assessFactoryExecution(repairValidation)");
    expect(healing).toContain("runtimeVerified: repairExecution.verified");
    expect(worker).toContain("structuralOnly: !runtimeVerified");
    expect(buildPage).toContain('project?.outputMaturity === "structural"');
    expect(assessFactoryExecution({ passed: true, stage: "structure" }).verified).toBe(false);
  });
});
