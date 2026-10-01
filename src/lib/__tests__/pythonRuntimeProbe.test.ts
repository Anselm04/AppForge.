import { describe, expect, it } from "vitest";
import {
  evidenceFromPythonProbeChecks,
  highestJustifiedPythonState,
  probePythonRuntime,
  readPythonProbeSummary,
  type PythonRuntimeProbeChecks,
} from "../pythonRuntimeProbe.js";
import {
  evaluateAdapterPromotion,
  stateRank,
} from "../adapterSdk.js";
import { getExternalTechnologyAdapter } from "../externalTechnologyAdapters.js";
import { resolveStackDependencyGraph } from "../stackDependencyResolver.js";

function baseChecks(
  overrides: Partial<PythonRuntimeProbeChecks> = {},
): PythonRuntimeProbeChecks {
  return {
    pythonBinary: "/usr/bin/python3",
    pythonVersion: "3.13.5",
    pipAvailable: true,
    pipVersion: "25.1.1",
    venvSupported: true,
    venvCreated: true,
    pipInstallVerified: true,
    fixtureCompiled: true,
    fixtureExecuted: true,
    fixtureOutput: "hello-probe",
    testsVerified: true,
    testRunner: "unittest",
    testOutput: "OK",
    serviceHealthVerified: true,
    serviceHealthStatus: 200,
    serviceHealthBody: '{"ok": true}',
    ...overrides,
  };
}

describe("pythonRuntimeProbe evidence mapping", () => {
  it("does not claim installVerified without pip+venv+install", () => {
    const evidence = evidenceFromPythonProbeChecks(
      baseChecks({ pipAvailable: false, venvCreated: false, pipInstallVerified: false }),
    );
    expect(evidence.discovered).toBe(true);
    expect(evidence.installVerified).toBe(false);
    expect(highestJustifiedPythonState(evidence)).toBe("discovered");
  });

  it("reaches runnable only when compile + fixture + health all pass", () => {
    const evidence = evidenceFromPythonProbeChecks(baseChecks());
    expect(evidence.runtimeVerified).toBe(true);
    expect(evidence.testsVerified).toBe(true);
    expect(highestJustifiedPythonState(evidence)).toBe("runnable");
    const promotion = evaluateAdapterPromotion("discovered", "runnable", evidence);
    expect(promotion.ok).toBe(true);
  });

  it("never invents packageable/deployable without packaging or deploy evidence", () => {
    const evidence = evidenceFromPythonProbeChecks(baseChecks());
    expect(evidence.packageVerified).not.toBe(true);
    expect(evidence.deploymentVerified).not.toBe(true);
    expect(stateRank(highestJustifiedPythonState(evidence))).toBeLessThan(
      stateRank("packageable"),
    );
  });
});

describe("pythonRuntimeProbe against the host", () => {
  it(
    "detects python/pip/venv, runs fixture+unittest, and health-checks a service",
    async () => {
      const result = await probePythonRuntime({ keepWorkspace: true });
      try {
        expect(result.checks.pythonBinary).toBeTruthy();
        expect(result.checks.pythonVersion).toMatch(/^\d+\.\d+\.\d+$/);
        expect(result.checks.pipAvailable).toBe(true);
        expect(result.checks.venvSupported).toBe(true);
        expect(result.checks.venvCreated).toBe(true);
        expect(result.checks.pipInstallVerified).toBe(true);
        expect(result.checks.fixtureCompiled).toBe(true);
        expect(result.checks.fixtureExecuted).toBe(true);
        expect(result.checks.fixtureOutput).toContain("hello-probe");
        expect(result.checks.testsVerified).toBe(true);
        expect(result.checks.testRunner).toBe("unittest");
        expect(result.checks.serviceHealthVerified).toBe(true);
        expect(result.checks.serviceHealthStatus).toBe(200);
        expect(result.justifiedState).toBe("runnable");
        expect(result.evidence.runtimeVerified).toBe(true);
        expect(result.evidence.testsVerified).toBe(true);
        expect(result.artifacts.length).toBeGreaterThanOrEqual(6);
        expect(result.errors).toEqual([]);

        const summary = await readPythonProbeSummary(result.workspaceDir!);
        expect(summary).toMatchObject({ justifiedState: "runnable" });
      } finally {
        if (result.workspaceDir) {
          const { rm } = await import("fs/promises");
          await rm(result.workspaceDir, { recursive: true, force: true });
        }
      }
    },
    180_000,
  );
});

describe("python-runtime registry promotion and stack inheritance", () => {
  it("registers python-runtime at runnable with evidence that justifies it", () => {
    const adapter = getExternalTechnologyAdapter("python-runtime");
    expect(adapter).toBeTruthy();
    expect(adapter!.state).toBe("runnable");
    expect(adapter!.evidence.discovered).toBe(true);
    expect(adapter!.evidence.installVerified).toBe(true);
    expect(adapter!.evidence.compileOrBuildVerified).toBe(true);
    expect(adapter!.evidence.runtimeVerified).toBe(true);
    expect(adapter!.evidence.testsVerified).toBe(true);
    expect(adapter!.evidence.packageVerified).not.toBe(true);
    expect(adapter!.lastVerifiedAt).toBe("2026-10-02T00:00:00.000Z");

    const promotion = evaluateAdapterPromotion(
      "unsupported",
      adapter!.state,
      adapter!.evidence,
    );
    expect(promotion.ok).toBe(true);
  });

  it("lets python-service and ai-agent-python inherit runnable via stack deps", () => {
    for (const stackId of ["python-service", "ai-agent-python"] as const) {
      const graph = resolveStackDependencyGraph(stackId);
      expect(graph.allowed).toBe(true);
      expect(graph.productionEligible).toBe(false);
      expect(graph.capabilityCeiling).toBe("runnable");
      expect(graph.dependencies[0]).toMatchObject({
        adapterId: "python-runtime",
        status: "resolved",
        resolvedState: "runnable",
        minimumCapabilityLevel: "runnable",
        runnerAvailable: true,
      });
    }
  });
});
