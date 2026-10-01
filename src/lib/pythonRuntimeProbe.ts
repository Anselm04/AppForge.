/**
 * Honest Python runtime probe for the python-runtime external technology
 * adapter. Detects python/pip/venv on the host via spawn (never assumed),
 * provisions a disposable venv when supported, compiles and runs a real
 * fixture, executes unittest against it, and health-checks a stdlib HTTP
 * service. Every capability flag is derived from real exit codes / responses.
 */

import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import {
  ADAPTER_CAPABILITY_STATES,
  evaluateAdapterPromotion,
  stateRank,
  type AdapterCapabilityState,
  type AdapterEvidence,
} from "./adapterSdk.js";
import {
  runCommand,
  whichPython,
  readPythonVersion,
  detectPip,
  detectVenvSupport,
  writeJson,
} from "./pythonRuntimeProbeSupport.js";
import {
  FIXTURE_MAIN,
  FIXTURE_TEST,
  HEALTH_CHECK_SCRIPT,
  LOCAL_PKG_INIT,
  LOCAL_PYPROJECT,
} from "./pythonRuntimeProbeFixtures.js";

export type { CommandResult } from "./pythonRuntimeProbeSupport.js";

export type PythonRuntimeProbeChecks = {
  pythonBinary: string | null;
  pythonVersion: string | null;
  pipAvailable: boolean;
  pipVersion: string | null;
  venvSupported: boolean;
  venvCreated: boolean;
  pipInstallVerified: boolean;
  fixtureCompiled: boolean;
  fixtureExecuted: boolean;
  fixtureOutput: string | null;
  testsVerified: boolean;
  testRunner: "unittest" | "pytest" | null;
  testOutput: string | null;
  serviceHealthVerified: boolean;
  serviceHealthStatus: number | null;
  serviceHealthBody: string | null;
};

export type PythonRuntimeProbeArtifact = {
  kind:
    | "detection"
    | "venv"
    | "pip_install"
    | "compile"
    | "fixture_run"
    | "unittest"
    | "service_health"
    | "summary";
  path: string;
  description: string;
};

export type PythonRuntimeProbeResult = {
  ok: boolean;
  checkedAt: string;
  workspaceDir: string | null;
  checks: PythonRuntimeProbeChecks;
  evidence: AdapterEvidence;
  justifiedState: AdapterCapabilityState;
  artifacts: PythonRuntimeProbeArtifact[];
  errors: string[];
};

function emptyChecks(): PythonRuntimeProbeChecks {
  return {
    pythonBinary: null,
    pythonVersion: null,
    pipAvailable: false,
    pipVersion: null,
    venvSupported: false,
    venvCreated: false,
    pipInstallVerified: false,
    fixtureCompiled: false,
    fixtureExecuted: false,
    fixtureOutput: null,
    testsVerified: false,
    testRunner: null,
    testOutput: null,
    serviceHealthVerified: false,
    serviceHealthStatus: null,
    serviceHealthBody: null,
  };
}

/**
 * Maps probe checks to AdapterEvidence flags. Flags are only true when the
 * corresponding host check actually passed — never speculated.
 */
export function evidenceFromPythonProbeChecks(
  checks: PythonRuntimeProbeChecks,
  ledgerIds: string[] = [],
): AdapterEvidence {
  const discovered = Boolean(checks.pythonBinary && checks.pythonVersion);
  const installVerified =
    discovered &&
    checks.pipAvailable &&
    checks.venvSupported &&
    checks.venvCreated &&
    checks.pipInstallVerified;
  const compileOrBuildVerified = installVerified && checks.fixtureCompiled;
  const runtimeVerified =
    compileOrBuildVerified &&
    checks.fixtureExecuted &&
    checks.serviceHealthVerified;
  const testsVerified = runtimeVerified && checks.testsVerified;

  const evidence: AdapterEvidence = {
    discovered,
    installVerified,
    compileOrBuildVerified,
    runtimeVerified,
    testsVerified,
  };
  if (ledgerIds.length > 0) {
    evidence.evidenceLedgerIds = ledgerIds;
  }
  return evidence;
}

/**
 * Highest capability state justified by evidence alone (monotonic from
 * unsupported). Mirrors the registry honesty test.
 */
export function highestJustifiedPythonState(
  evidence: AdapterEvidence,
): AdapterCapabilityState {
  let highest: AdapterCapabilityState = "unsupported";
  for (const candidate of ADAPTER_CAPABILITY_STATES) {
    const result = evaluateAdapterPromotion("unsupported", candidate, evidence);
    if (result.ok && stateRank(candidate) > stateRank(highest)) {
      highest = candidate;
    }
  }
  return highest;
}

export type ProbePythonRuntimeOptions = {
  /** Keep the disposable workspace for inspection (tests usually leave false). */
  keepWorkspace?: boolean;
  /** Override the workspace root (defaults to os.tmpdir()). */
  workspaceParent?: string;
};

/**
 * Runs the full python-runtime capability probe against the current host.
 */
export async function probePythonRuntime(
  options: ProbePythonRuntimeOptions = {},
): Promise<PythonRuntimeProbeResult> {
  const checkedAt = new Date().toISOString();
  const checks = emptyChecks();
  const artifacts: PythonRuntimeProbeArtifact[] = [];
  const errors: string[] = [];
  let workspaceDir: string | null = null;

  const recordArtifact = async (
    kind: PythonRuntimeProbeArtifact["kind"],
    fileName: string,
    description: string,
    payload: unknown,
  ) => {
    if (!workspaceDir) return;
    const path = join(workspaceDir, "evidence", fileName);
    await mkdir(join(workspaceDir, "evidence"), { recursive: true });
    await writeJson(path, payload);
    artifacts.push({ kind, path, description });
  };

  try {
    workspaceDir = await mkdtemp(
      join(options.workspaceParent ?? tmpdir(), "appforge-python-runtime-"),
    );
    await mkdir(join(workspaceDir, "evidence"), { recursive: true });

    const pythonBinary = await whichPython();
    checks.pythonBinary = pythonBinary;
    if (!pythonBinary) {
      errors.push("No python3/python binary available on PATH.");
      await recordArtifact(
        "detection",
        "detection.json",
        "Python binary detection",
        { pythonBinary: null, error: errors[0] },
