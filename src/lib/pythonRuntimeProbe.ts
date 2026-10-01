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
