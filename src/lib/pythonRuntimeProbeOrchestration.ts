/** Python runtime probe orchestration (evidence + host probe). */
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
      );
    } else {
      const version = await readPythonVersion(pythonBinary);
      checks.pythonVersion = version;
      if (!version) {
        errors.push(`Failed to read a version string from ${pythonBinary}.`);
      }

      const pip = await detectPip(pythonBinary);
      checks.pipAvailable = pip.available;
      checks.pipVersion = pip.version;
      if (!pip.available) {
        errors.push("python -m pip is not available on this host.");
      }

      checks.venvSupported = await detectVenvSupport(pythonBinary);
      if (!checks.venvSupported) {
        errors.push("python -m venv is not supported on this host.");
      }

      await recordArtifact(
        "detection",
        "detection.json",
        "Python/pip/venv detection",
        {
          pythonBinary,
          pythonVersion: version,
          pipAvailable: pip.available,
          pipVersion: pip.version,
          venvSupported: checks.venvSupported,
        },
      );
    }

    if (
      checks.pythonBinary &&
      checks.pythonVersion &&
      checks.pipAvailable &&
      checks.venvSupported
    ) {
      const venvDir = join(workspaceDir, ".venv");
      const venvCreate = await runCommand(
        checks.pythonBinary,
        ["-m", "venv", venvDir],
        { timeoutMs: 60_000 },
      );
      checks.venvCreated = venvCreate.exitCode === 0;
      await recordArtifact("venv", "venv.json", "venv creation", {
        exitCode: venvCreate.exitCode,
        stdout: venvCreate.stdout.slice(0, 2_000),
        stderr: venvCreate.stderr.slice(0, 2_000),
        timedOut: venvCreate.timedOut,
        venvDir,
      });
      if (!checks.venvCreated) {
        errors.push(
          `venv creation failed: ${(venvCreate.stderr || venvCreate.stdout).slice(0, 400)}`,
        );
      } else {
        const venvPython = join(venvDir, "bin", "python");
        const pkgRoot = join(workspaceDir, "local_pkg");
        await mkdir(join(pkgRoot, "appforge_python_probe_pkg"), {
          recursive: true,
        });
        await writeFile(
          join(pkgRoot, "appforge_python_probe_pkg", "__init__.py"),
          LOCAL_PKG_INIT,
          "utf8",
        );
        await writeFile(join(pkgRoot, "pyproject.toml"), LOCAL_PYPROJECT, "utf8");
        const pipInstall = await runCommand(
          venvPython,
          ["-m", "pip", "install", "--disable-pip-version-check", "."],
          { cwd: pkgRoot, timeoutMs: 120_000 },
        );
        const importCheck = await runCommand(
          venvPython,
          ["-c", "import appforge_python_probe_pkg as p; print(p.VERSION)"],
          { timeoutMs: 15_000 },
        );
        checks.pipInstallVerified =
          pipInstall.exitCode === 0 &&
          importCheck.exitCode === 0 &&
          importCheck.stdout.includes("0.0.1");
        await recordArtifact("pip_install", "pip_install.json", "venv pip install", {
          exitCode: pipInstall.exitCode,
          stdout: pipInstall.stdout.slice(0, 4_000),
          stderr: pipInstall.stderr.slice(0, 4_000),
          timedOut: pipInstall.timedOut,
          importExitCode: importCheck.exitCode,
          importStdout: importCheck.stdout.trim(),
        });
        if (!checks.pipInstallVerified) {
          errors.push(
            `pip install into venv failed: ${(pipInstall.stderr || pipInstall.stdout || importCheck.stderr).slice(0, 400)}`,
          );
        }

        const fixtureRoot = join(workspaceDir, "fixture");
        await mkdir(join(fixtureRoot, "app"), { recursive: true });
        await mkdir(join(fixtureRoot, "tests"), { recursive: true });
        await writeFile(join(fixtureRoot, "app", "__init__.py"), "", "utf8");
        await writeFile(join(fixtureRoot, "app", "main.py"), FIXTURE_MAIN, "utf8");
        await writeFile(join(fixtureRoot, "tests", "__init__.py"), "", "utf8");
        await writeFile(
          join(fixtureRoot, "tests", "test_main.py"),
          FIXTURE_TEST,
          "utf8",
        );

        const compile = await runCommand(
          venvPython,
          ["-m", "compileall", "-q", "app"],
          { cwd: fixtureRoot, timeoutMs: 30_000 },
        );
        checks.fixtureCompiled = compile.exitCode === 0;
        await recordArtifact("compile", "compile.json", "compileall fixture", {
          exitCode: compile.exitCode,
          stdout: compile.stdout.slice(0, 2_000),
          stderr: compile.stderr.slice(0, 2_000),
          timedOut: compile.timedOut,
        });
        if (!checks.fixtureCompiled) {
          errors.push(
            `compileall failed: ${(compile.stderr || compile.stdout).slice(0, 400)}`,
          );
        }

        const fixtureRun = await runCommand(venvPython, ["-m", "app.main"], {
          cwd: fixtureRoot,
          timeoutMs: 15_000,
        });
        checks.fixtureExecuted =
          fixtureRun.exitCode === 0 && fixtureRun.stdout.includes("hello-probe");
        checks.fixtureOutput = fixtureRun.stdout.trim().slice(0, 500) || null;
        await recordArtifact("fixture_run", "fixture_run.json", "fixture execution", {
          exitCode: fixtureRun.exitCode,
          stdout: fixtureRun.stdout.slice(0, 2_000),
          stderr: fixtureRun.stderr.slice(0, 2_000),
          timedOut: fixtureRun.timedOut,
        });
        if (!checks.fixtureExecuted) {
          errors.push(
            `fixture execution failed: ${(fixtureRun.stderr || fixtureRun.stdout).slice(0, 400)}`,
          );
        }

        const unittestRun = await runCommand(
          venvPython,
          ["-m", "unittest", "discover", "-s", "tests", "-v"],
          { cwd: fixtureRoot, timeoutMs: 30_000 },
        );
        checks.testsVerified =
          unittestRun.exitCode === 0 &&
          /OK\s*$/m.test(unittestRun.stderr + unittestRun.stdout);
        checks.testRunner = checks.testsVerified ? "unittest" : null;
        checks.testOutput = `${unittestRun.stdout}\n${unittestRun.stderr}`
          .trim()
          .slice(0, 2_000);
        await recordArtifact("unittest", "unittest.json", "unittest fixture", {
          exitCode: unittestRun.exitCode,
          stdout: unittestRun.stdout.slice(0, 4_000),
          stderr: unittestRun.stderr.slice(0, 4_000),
          timedOut: unittestRun.timedOut,
          runner: checks.testRunner,
        });
        if (!checks.testsVerified) {
          errors.push(
            `unittest failed: ${(unittestRun.stderr || unittestRun.stdout).slice(0, 400)}`,
          );
        }

        await writeFile(
          join(fixtureRoot, "health_check.py"),
          HEALTH_CHECK_SCRIPT,
          "utf8",
        );
        const healthRun = await runCommand(venvPython, ["health_check.py"], {
          cwd: fixtureRoot,
          timeoutMs: 20_000,
        });
        let healthStatus: number | null = null;
        let healthBody: string | null = null;
        let healthPayload: Record<string, unknown> | null = null;
        try {
          healthPayload = JSON.parse(healthRun.stdout.trim()) as Record<
            string,
            unknown
          >;
          healthStatus =
            typeof healthPayload.status === "number"
