/** Shared process helpers for the python-runtime probe. */
import { spawn } from "child_process";
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
  FIXTURE_MAIN,
  FIXTURE_TEST,
  HEALTH_CHECK_SCRIPT,
  LOCAL_PKG_INIT,
  LOCAL_PYPROJECT,
} from "./pythonRuntimeProbeFixtures.js";

export type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

export function runCommand(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    timeoutMs?: number;
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<CommandResult> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      shell: false,
      env: options.env ?? process.env,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;
    const finish = (exitCode: number) => {
      if (settled) return;
      settled = true;
      resolve({ exitCode, stdout, stderr, timedOut });
    };
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!settled) child.kill("SIGKILL");
      }, 2_000).unref?.();
    }, timeoutMs);
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      stderr = stderr || err.message;
      finish(1);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      finish(code ?? 1);
    });
  });
}

export async function whichPython(): Promise<string | null> {
  for (const candidate of ["python3", "python"]) {
    const result = await runCommand(
      candidate,
      ["-c", "import sys; print(sys.executable)"],
      { timeoutMs: 8_000 },
    );
    if (result.exitCode === 0) {
      const path = result.stdout.trim().split("\n").filter(Boolean).pop();
      if (path) return path;
    }
  }
  return null;
}

export async function readPythonVersion(pythonBinary: string): Promise<string | null> {
  const result = await runCommand(
    pythonBinary,
    [
      "-c",
      "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')",
    ],
    { timeoutMs: 8_000 },
  );
  if (result.exitCode !== 0) return null;
  const version = result.stdout.trim();
  return /^\d+\.\d+\.\d+$/.test(version) ? version : null;
}

export async function detectPip(
  pythonBinary: string,
): Promise<{ available: boolean; version: string | null }> {
  const result = await runCommand(pythonBinary, ["-m", "pip", "--version"], {
    timeoutMs: 15_000},
  );
  if (result.exitCode !== 0) {
    return { available: false, version: null };
  }
  const match = result.stdout.trim().match(/pip\s+(\S+)/i);
  return { available: true, version: match?.[1] ?? result.stdout.trim() };
}

export async function detectVenvSupport(pythonBinary: string): Promise<boolean> {
  const help = await runCommand(pythonBinary, ["-m", "venv", "--help"], {
    timeoutMs: 10_000,
  });
  if (help.exitCode === 0) return true;
  const importCheck = await runCommand(
    pythonBinary,
    ["-c", "import venv; print('ok')"],
    { timeoutMs: 8_000 },
  );
  return importCheck.exitCode === 0 && importCheck.stdout.includes("ok");
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

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
