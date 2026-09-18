import { spawn } from "child_process";
import { mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

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
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({ exitCode: 1, stdout, stderr: stderr + "\n[TIMEOUT]" });
    }, timeoutMs);
    child.stdout?.on("data", (d) => (stdout += d.toString()));
    child.stderr?.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ exitCode: 1, stdout, stderr: err.message });
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

function safeRelativePath(value: string): string | null {
  const normalized = value.replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = normalized
    .split("/")
    .filter((part) => part && part !== ".");
  if (parts.length === 0 || parts.some((part) => part === "..")) return null;
  return parts.join("/");
}

function hardenedRunArgs(tmpDir: string): string[] {
  return [
    "run",
    "--rm",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--pids-limit=256",
    "--memory=768m",
    "--cpus=1.5",
    "-v",
    `${tmpDir}:/app`,
    "-w",
    "/app",
  ];
}

export async function validateWithDocker(
  files: Record<string, string>,
  techStack: string,
): Promise<DockerValidationResult | null> {
  if (!(await dockerAvailable())) return null;

  const start = Date.now();
  const tmpDir = join(tmpdir(), `appforge-docker-${Date.now()}`);
  const errors: string[] = [];

  try {
    await mkdir(tmpDir, { recursive: true });
    for (const [path, content] of Object.entries(files)) {
      if (typeof content !== "string") continue;
      const safePath = safeRelativePath(path);
      if (!safePath) continue;
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
      const entry = files["main.py"] ? "main.py" : "src/main.py";
      const r = await runDocker(
        [
          ...hardenedRunArgs(tmpDir),
          "python:3.12-slim",
          "sh",
          "-c",
          `pip install -q -r requirements.txt 2>/dev/null; python -m py_compile ${entry}`,
        ],
        120_000,
      );
      if (r.exitCode !== 0) {
        errors.push((r.stderr || r.stdout).slice(0, 500));
        return {
          passed: false,
          stage: "docker_python",
          errors,
          durationMs: Date.now() - start,
        };
      }
      return {
        passed: true,
        stage: "docker_python",
        errors: [],
        durationMs: Date.now() - start,
      };
    }

    if (stack.includes("flutter") || files["pubspec.yaml"]) {
      const r = await runDocker(
        [
          ...hardenedRunArgs(tmpDir),
          "ghcr.io/cirruslabs/flutter:stable",
          "flutter",
          "analyze",
          "--no-pub",
        ],
        180_000,
      );
      if (r.exitCode !== 0) {
        errors.push((r.stderr || r.stdout).slice(0, 500));
        return {
          passed: false,
          stage: "docker_flutter",
          errors,
          durationMs: Date.now() - start,
        };
      }
      return {
        passed: true,
        stage: "docker_flutter",
        errors: [],
        durationMs: Date.now() - start,
      };
    }

    if (files["package.json"] || files["src/package.json"]) {
      const workdir = files["package.json"] ? "/app" : "/app/src";
      const mountArgs = hardenedRunArgs(tmpDir);
      const workdirIndex = mountArgs.indexOf("-w");
      if (workdirIndex >= 0) mountArgs[workdirIndex + 1] = workdir;

      const nodeValidation = [
        "npm install --ignore-scripts --no-audit --no-fund --loglevel=error",
        "if [ -f tsconfig.json ]; then npx --no-install tsc --noEmit; fi",
        "if node -e \"const p=require('./package.json');process.exit(p.scripts&&p.scripts.test?0:1)\"; then npm test -- --run; fi",
        "if node -e \"const p=require('./package.json');process.exit(p.scripts&&p.scripts.build?0:1)\"; then npm run build; fi",
      ].join(" && ");

      const r = await runDocker(
        [...mountArgs, "node:22-alpine", "sh", "-c", nodeValidation],
        240_000,
      );
      if (r.exitCode !== 0) {
        errors.push((r.stderr || r.stdout).slice(0, 1200));
        return {
          passed: false,
          stage: "docker_node",
          errors,
          durationMs: Date.now() - start,
        };
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


function runFlyctl(
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("flyctl", args, {
      cwd,
      shell: false,
      env: { ...process.env, NO_COLOR: "1" },
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (exitCode: number) => {
      if (settled) return;
      settled = true;
      resolve({ exitCode, stdout, stderr });
    };
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      stderr += "\n[TIMEOUT]";
      finish(1);
    }, timeoutMs);
    child.stdout?.on("data", (d) => (stdout += d.toString()));
    child.stderr?.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => {
      clearTimeout(timer);
      finish(code ?? 1);
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      stderr += err.message;
      finish(1);
    });
  });
}

async function flyRemoteBuildAvailable(): Promise<boolean> {
  if (process.env.FLY_REMOTE_VALIDATION === "false") return false;
  if (!process.env.FLY_API_TOKEN) return false;
  const r = await runFlyctl(["version"], process.cwd(), 10_000);
  return r.exitCode === 0;
}

/**
 * Production fallback when a Docker daemon is intentionally unavailable.
 * Fly's remote builder receives the generated source and executes install,
 * typecheck, blocking tests and production build inside a separate BuildKit
 * environment. --build-only guarantees this validation never deploys.
 */
export async function validateWithFlyRemoteBuild(
  files: Record<string, string>,
  techStack: string,
): Promise<DockerValidationResult | null> {
  if (!(await flyRemoteBuildAvailable())) return null;
  if (!files["package.json"] && !files["src/package.json"]) return null;

  const start = Date.now();
  const tmpDir = join(tmpdir(), `appforge-fly-remote-${Date.now()}`);
  const errors: string[] = [];
  const app =
    process.env.APPFORGE_SANDBOX_FLY_APP ??
    process.env.FLY_APP_NAME ??
    "appforge-unfurling-moon-9058";

  try {
    await mkdir(tmpDir, { recursive: true });
    for (const [path, content] of Object.entries(files)) {
      if (typeof content !== "string") continue;
      const safePath = safeRelativePath(path);
      if (!safePath) continue;
      const full = join(tmpDir, safePath);
      await mkdir(join(full, ".."), { recursive: true });
      await writeFile(full, content, "utf-8");
    }

    const workdir = files["package.json"] ? "/app" : "/app/src";
    const dockerfile = `FROM node:22-alpine
WORKDIR /app
COPY . .
WORKDIR ${workdir}
RUN npm install --ignore-scripts --no-audit --no-fund --loglevel=error \\
 && if [ -f tsconfig.json ]; then npx --no-install tsc --noEmit; fi \\
 && if node -e "const p=require('./package.json');process.exit(p.scripts&&p.scripts.test?0:1)"; then npm test -- --run; fi \\
 && if node -e "const p=require('./package.json');process.exit(p.scripts&&p.scripts.build?0:1)"; then npm run build; fi
CMD ["node", "-e", "process.exit(0)"]
`;
    await writeFile(
      join(tmpDir, "Dockerfile.appforge-validation"),
      dockerfile,
      "utf-8",
    );

    const r = await runFlyctl(
      [
        "deploy",
        ".",
        "--remote-only",
        "--build-only",
        "--app",
        app,
        "--dockerfile",
        "Dockerfile.appforge-validation",
      ],
      tmpDir,
      300_000,
    );

    if (r.exitCode !== 0) {
      errors.push((r.stderr || r.stdout).slice(-2000));
      return {
        passed: false,
        stage: "fly_remote_node",
        errors,
        durationMs: Date.now() - start,
      };
    }

    return {
      passed: true,
      stage: "fly_remote_node",
      errors: [],
      durationMs: Date.now() - start,
    };
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
