import { spawn } from "child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, rm } from "fs/promises";
import { join, posix } from "path";
import { tmpdir } from "os";
import { NODE_RUNTIME_PROBE } from "./dockerRuntimeProbe.js";

export type DockerValidationResult = {
  passed: boolean;
  stage: string;
  errors: string[];
  durationMs: number;
  skipped?: boolean;
};

function runDocker(
  args: string[],
  timeoutMs: number,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("docker", args, { shell: false });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;
    const finish = (result: {
      exitCode: number;
      stdout: string;
      stderr: string;
    }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const timer = setTimeout(async () => {
      timedOut = true;
      child.kill("SIGTERM");
      // Killing the CLI does not stop its container. Remove only this run's
      // generated identity, and wait for bounded cleanup before returning.
      const nameIndex = args.indexOf("--name");
      const name = nameIndex >= 0 ? args[nameIndex + 1] : undefined;
      let cleanupError = "";
      if (args[0] === "run" && name?.startsWith("appforge-validation-")) {
        const cleanup = await runDocker(["rm", "--force", name], 10_000);
        if (cleanup.exitCode !== 0)
          cleanupError = "\n[CONTAINER CLEANUP FAILED]";
      }
      finish({
        exitCode: 1,
        stdout,
        stderr: stderr + "\n[TIMEOUT]" + cleanupError,
      });
    }, timeoutMs);
    child.stdout?.on("data", (d) => (stdout += d.toString()));
    child.stderr?.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => {
      clearTimeout(timer);
      if (!timedOut) finish({ exitCode: code ?? 1, stdout, stderr });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      if (!timedOut) finish({ exitCode: 1, stdout, stderr: err.message });
    });
  });
}

async function dockerAvailable(): Promise<boolean> {
  if (process.env.DOCKER_VALIDATION === "false") return false;
  const r = await runDocker(
    ["version", "--format", "{{.Server.Version}}"],
    8000,
  );
  return r.exitCode === 0 && r.stdout.trim().length > 0;
}

export function safeDockerRelativePath(value: string): string | null {
  if (
    !value ||
    value.includes("\0") ||
    value.includes("\\") ||
    value.startsWith("/") ||
    /^[A-Za-z]:\//.test(value)
  ) {
    return null;
  }
  const normalized = posix.normalize(value);
  const canonicalInput = value.replace(/^\.\//, "");
  if (
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    normalized !== canonicalInput
  ) {
    return null;
  }
  return normalized;
}

function hardenedRunArgs(
  tmpDir: string,
  options: { networkNone?: boolean; workdir?: string; hostUser?: boolean } = {},
): string[] {
  const args = [
    "run",
    "--rm",
    "--name",
    `appforge-validation-${randomUUID()}`,
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--pids-limit=256",
    "--memory=768m",
    "--cpus=1.5",
    "--ulimit",
    "nofile=1024:1024",
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,size=64m",
  ];
  if (options.hostUser && process.getuid && process.getgid) {
    // Match the artifact owner without restoring root's filesystem capabilities.
    args.push("--user", `${process.getuid()}:${process.getgid()}`);
    args.push("-e", "npm_config_cache=/tmp/appforge-npm-cache");
  }
  if (options.networkNone) args.push("--network=none");
  args.push("-v", `${tmpDir}:/app`, "-w", options.workdir ?? "/app");
  return args;
}

function dockerFailure(
  stage: string,
  start: number,
  detail: string,
): DockerValidationResult {
  return {
    passed: false,
    stage,
    errors: [detail.slice(0, 1200)],
    durationMs: Date.now() - start,
  };
}

export async function validateWithDocker(
  files: Record<string, string>,
  techStack: string,
): Promise<DockerValidationResult | null> {
  if (!(await dockerAvailable())) return null;

  const start = Date.now();
  const tmpDir = join(tmpdir(), `appforge-docker-${randomUUID()}`);

  try {
    await mkdir(tmpDir, { recursive: true });
    for (const [path, content] of Object.entries(files)) {
      if (typeof content !== "string") {
        return dockerFailure(
          "docker_input_security",
          start,
          `Generated file is not text: ${path}`,
        );
      }
      const safePath = safeDockerRelativePath(path);
      if (!safePath) {
        return dockerFailure(
          "docker_input_security",
          start,
          `Generated file path escapes or is non-canonical: ${path}`,
        );
      }
      const full = join(tmpDir, safePath);
      await mkdir(join(full, ".."), { recursive: true });
      await writeFile(full, content, "utf-8");
    }

    const stack = techStack.toLowerCase();
    if (
      stack.includes("python") ||
      stack.includes("langchain") ||
      stack.includes("crewai") ||
      stack.includes("autogen")
    ) {
      const req = files["requirements.txt"] ?? "flask\n";
      if (!files["requirements.txt"]) {
        await writeFile(join(tmpDir, "requirements.txt"), req, "utf-8");
      }

      const installAndAudit = await runDocker(
        [
          ...hardenedRunArgs(tmpDir),
          "python:3.12-slim",
          "sh",
          "-c",
          [
            "python -m pip install -q --disable-pip-version-check pip-audit",
            "pip-audit -r requirements.txt",
            "python -m pip install -q --disable-pip-version-check --no-compile --target .appforge-deps -r requirements.txt",
          ].join(" && "),
        ],
        180_000,
      );
      if (installAndAudit.exitCode !== 0) {
        return dockerFailure(
          "docker_python_security",
          start,
          installAndAudit.stderr || installAndAudit.stdout,
        );
      }

      const entry = files["main.py"]
        ? "main.py"
        : files["src/main.py"]
          ? "src/main.py"
          : files["app/main.py"]
            ? "app/main.py"
            : files["agent.py"]
              ? "agent.py"
              : null;
      if (!entry) {
        return dockerFailure(
          "docker_python_security",
          start,
          "Python generated project has no validated entrypoint",
        );
      }

      const offlineValidation = await runDocker(
        [
          ...hardenedRunArgs(tmpDir, { networkNone: true }),
          "-e",
          "PYTHONPATH=/app/.appforge-deps",
          "python:3.12-slim",
          "python",
          "-m",
          "py_compile",
          entry,
        ],
        60_000,
      );
      if (offlineValidation.exitCode !== 0) {
        return dockerFailure(
          "docker_python",
          start,
          offlineValidation.stderr || offlineValidation.stdout,
        );
      }
      return dockerFailure(
        "isolation",
        start,
        "Python syntax checks passed, but this Docker runner does not yet prove behavioral tests, a production build, and runtime. Full isolated validation is required.",
      );
    }

    if (stack.includes("flutter") || files["pubspec.yaml"]) {
      const r = await runDocker(
        [
          ...hardenedRunArgs(tmpDir, { networkNone: true }),
          "ghcr.io/cirruslabs/flutter:stable",
          "flutter",
          "analyze",
          "--no-pub",
        ],
        180_000,
      );
      if (r.exitCode !== 0) {
        return dockerFailure("docker_flutter", start, r.stderr || r.stdout);
      }
      return dockerFailure(
        "isolation",
        start,
        "Flutter analysis passed, but this Docker runner does not yet prove tests, build, and runtime. Full isolated validation is required.",
      );
    }

    if (files["package.json"] || files["src/package.json"]) {
      const workdir = files["package.json"] ? "/app" : "/app/src";
      try {
        const pkg = JSON.parse(
          files["package.json"] ?? files["src/package.json"],
        );
        const hasScript = (name: string) =>
          typeof pkg.scripts?.[name] === "string" &&
          pkg.scripts[name].trim().length > 0;
        if (
          !hasScript("test") ||
          !hasScript("build") ||
          !(hasScript("start") || hasScript("preview"))
        ) {
          return dockerFailure(
            "docker_contract",
            start,
            "Node validation requires non-empty test, build, and start or preview scripts. Missing steps cannot be skipped.",
          );
        }
      } catch {
        return dockerFailure(
          "docker_contract",
          start,
          "Node validation requires a valid package.json.",
        );
      }

      const dependencyProof = await runDocker(
        [
          ...hardenedRunArgs(tmpDir, { workdir, hostUser: true }),
          "node:22-alpine",
          "sh",
          "-c",
          [
            "npm install --ignore-scripts --no-fund --loglevel=error",
            "npm audit --audit-level=high",
          ].join(" && "),
        ],
        240_000,
      );
      if (dependencyProof.exitCode !== 0) {
        return dockerFailure(
          "docker_node_security",
          start,
          dependencyProof.stderr || dependencyProof.stdout,
        );
      }

      const nodeValidation = [
        "if [ -f tsconfig.json ]; then npx --no-install tsc --noEmit; fi",
        "CI=true npm test",
        "npm run build",
      ].join(" && ");

      const offlineValidation = await runDocker(
        [
          ...hardenedRunArgs(tmpDir, {
            networkNone: true,
            workdir,
            hostUser: true,
          }),
          "node:22-alpine",
          "sh",
          "-c",
          nodeValidation,
        ],
        240_000,
      );
      if (offlineValidation.exitCode !== 0) {
        return dockerFailure(
          "docker_node",
          start,
          offlineValidation.stderr || offlineValidation.stdout,
        );
      }
      const runtime = await runDocker(
        [
          ...hardenedRunArgs(tmpDir, {
            networkNone: true,
            workdir,
            hostUser: true,
          }),
          "node:22-alpine",
          "node",
          "--disable-sigusr1",
          "-e",
          NODE_RUNTIME_PROBE,
        ],
        45_000,
      );
      if (runtime.exitCode !== 0) {
        return dockerFailure(
          "docker_node_runtime",
          start,
          runtime.stderr || runtime.stdout,
        );
      }

      return {
        passed: true,
        stage: "docker_node",
        errors: [],
        durationMs: Date.now() - start,
      };
    }

    return null;
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
