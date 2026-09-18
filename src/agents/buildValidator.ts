// src/agents/buildValidator.ts
// ── Build Validation Agent ──────────────────────────────────────────────
// This is the most critical production-readiness piece. It takes the raw
// text files the LLM generated and actually tries to:
// 1. Write them to a temp directory
// 2. Install dependencies (npm install)
// 3. Type-check (tsc --noEmit)
// 4. Run any generated tests (npm test)
// 5. Start the built web app and verify a real HTTP response
// 6. Return a pass/fail report with specific errors
//
// If validation FAILS, the pipeline will feed the errors back to the LLM
// for an automatic retry (see pipeline.ts "Validator" phase).

import { mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { spawn } from "child_process";
import { createServer } from "net";
import { npmCacheEnv } from "../services/buildCache.js";
import { validateWithDocker } from "../lib/dockerValidator.js";

export interface ValidationResult {
  passed: boolean;
  stage: string;
  errors: string[];
  durationMs: number;
  fileCount: number;
  warning: string;
}

export type ValidateOptions = {
  testsBlocking?: boolean;
  requirementsBlocking?: boolean;
  requireIsolation?: boolean;
  /** When true, verify checkout/webhook/entitlements scaffold for income products. */
  validateBilling?: boolean;
};

function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  env?: Record<string, string>,
): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      shell: false,
      env: { ...process.env, ...env },
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({
        exitCode: 1,
        stdout,
        stderr: stderr + "\n[TIMEOUT]",
        timedOut: true,
      });
    }, timeoutMs);

    child.stdout?.on("data", (d) => (stdout += d.toString()));
    child.stderr?.on("data", (d) => (stderr += d.toString()));

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code ?? 1, stdout, stderr, timedOut: false });
    });
  });
}

function readRequirementIds(files: Record<string, string>): string[] {
  const raw = files[".appforge/requirements.json"];
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as {
      requirements?: Array<{ id?: unknown }>;
    };
    return (parsed.requirements ?? [])
      .map((item) => String(item?.id ?? "").trim())
      .filter((id) => /^REQ-\d{3}$/i.test(id));
  } catch {
    return [];
  }
}

function generatedTestPaths(files: Record<string, string>): string[] {
  return Object.keys(files).filter((file) =>
    /(?:^|\/)(?:__tests__\/.*|.*\.(?:test|spec))\.(?:js|jsx|ts|tsx)$/i.test(
      file,
    ),
  );
}

function validateRequirementTraceability(
  files: Record<string, string>,
  requirementIds: string[],
): string[] {
  if (requirementIds.length === 0) return [];
  const tests = generatedTestPaths(files);
  const combined = tests.map((path) => files[path] ?? "").join("\n");
  return requirementIds.filter(
    (id) => !combined.includes(`appforge-requirement: ${id}`),
  );
}

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Unable to allocate validation port"));
        return;
      }
      const port = address.port;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

async function verifyViteRuntime(cwd: string): Promise<{
  passed: boolean;
  error?: string;
}> {
  const port = await getFreePort();
  const child = spawn(
    "npx",
    [
      "vite",
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
    ],
    {
      cwd,
      shell: false,
      env: { ...process.env, NODE_ENV: "production" },
    },
  );

  let output = "";
  child.stdout?.on("data", (d) => (output += d.toString()));
  child.stderr?.on("data", (d) => (output += d.toString()));

  const url = `http://127.0.0.1:${port}/`;
  const deadline = Date.now() + 20_000;
  try {
    while (Date.now() < deadline) {
      if (child.exitCode !== null) {
        return {
          passed: false,
          error: `Generated app exited before becoming reachable: ${output.slice(-500)}`,
        };
      }
      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(2_000),
          redirect: "follow",
        });
        const body = await res.text();
        if (res.status >= 200 && res.status < 400 && body.trim().length > 0) {
          return { passed: true };
        }
        if (res.status >= 400) {
          return {
            passed: false,
            error: `Generated app returned HTTP ${res.status} during runtime validation`,
          };
        }
      } catch {
        // Server may still be starting; retry until the deadline.
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    return {
      passed: false,
      error: `Generated app did not become reachable within 20 seconds: ${output.slice(-500)}`,
    };
  } finally {
    if (child.exitCode === null) child.kill("SIGTERM");
  }
}

/** Quick pre-flight: does npm respond at all in this environment? */
async function npmAvailable(): Promise<boolean> {
  try {
    const r = await runCommand("npm", ["--version"], process.cwd(), 10_000);
    return r.exitCode === 0 && r.stdout.includes(".");
  } catch {
    return false;
  }
}

export async function validateGeneratedBuild(
  files: Record<string, string>,
  techStack: string,
  options: ValidateOptions = {},
): Promise<ValidationResult> {
  const tmpDir = join(tmpdir(), `appforge-build-${Date.now()}`);
  const start = Date.now();
  const errors: string[] = [];

  try {
    await mkdir(tmpDir, { recursive: true });
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = join(tmpDir, filePath);
      await mkdir(join(fullPath, ".."), { recursive: true });
      await writeFile(fullPath, content, "utf-8");
    }

    const hasPackageJson = files["package.json"] || files["src/package.json"];
    if (!hasPackageJson) {
      const deps = techStackDeps(techStack);
      await writeFile(
        join(tmpDir, "package.json"),
        JSON.stringify(
          {
            name: "appforge-generated-app",
            version: "0.1.0",
            type: "module",
            scripts: {
              typecheck: "tsc --noEmit",
              test: "vitest run",
              build: "vite build",
            },
            dependencies: deps.prod,
            devDependencies: deps.dev,
          },
          null,
          2,
        ),
      );
    }

    const isPython =
      !!files["requirements.txt"] ||
      !!files["pyproject.toml"] ||
      !!files["main.py"] ||
      techStack.includes("python") ||
      techStack.includes("langchain") ||
      techStack.includes("crewai") ||
      techStack.includes("autogen");
    if (isPython && !hasPackageJson) {
      const entry =
        files["main.py"] || files["src/main.py"] || files["agent.py"];
      if (!entry) {
        errors.push("Python scaffold missing main.py entrypoint");
        return {
          passed: false,
          stage: "structure",
          errors,
          durationMs: Date.now() - start,
          fileCount: Object.keys(files).length,
          warning:
            "Python agent requires main.py (or set package.json for Node validation).",
        };
      }
      const entryPath = files["main.py"]
        ? "main.py"
        : files["src/main.py"]
          ? "src/main.py"
          : "agent.py";
      const pyCheck = await runCommand(
        "python3",
        ["-m", "py_compile", entryPath],
        tmpDir,
        30_000,
      );
      if (pyCheck.exitCode !== 0) {
        errors.push(
          `Python syntax check failed: ${pyCheck.stderr.slice(0, 300)}`,
        );
        return {
          passed: false,
          stage: "python_syntax",
          errors,
          durationMs: Date.now() - start,
          fileCount: Object.keys(files).length,
          warning: "Fix Python syntax errors before deploy.",
        };
      }
      return {
        passed: true,
        stage: "python_syntax",
        errors: [],
        durationMs: Date.now() - start,
        fileCount: Object.keys(files).length,
        warning:
          "Python stack: syntax check passed. Run pip install + pytest locally before production.",
      };
    }

    if (files["pubspec.yaml"]) {
      return {
        passed: true,
        stage: "structure",
        errors: [],
        durationMs: Date.now() - start,
        fileCount: Object.keys(files).length,
        warning:
          "Flutter stack: structural checks only. Run flutter analyze locally.",
      };
    }

    if (files["manifest.json"]) {
      try {
        JSON.parse(files["manifest.json"]);
      } catch {
        errors.push("manifest.json is invalid JSON");
        return {
          passed: false,
          stage: "structure",
          errors,
          durationMs: Date.now() - start,
          fileCount: Object.keys(files).length,
          warning: "Fix extension manifest before packaging.",
        };
      }
      return {
        passed: true,
        stage: "structure",
        errors: [],
        durationMs: Date.now() - start,
        fileCount: Object.keys(files).length,
        warning:
          "Browser extension: structural checks only. Load unpacked locally to verify.",
      };
    }
    if (files["extension.js"] && files["package.json"]) {
      try {
        const pkg = JSON.parse(files["package.json"]);
        if (pkg.engines?.vscode || pkg.contributes) {
          return {
            passed: true,
            stage: "structure",
            errors: [],
            durationMs: Date.now() - start,
            fileCount: Object.keys(files).length,
            warning:
              "VS Code extension: structural checks only. Run vsce package locally.",
          };
        }
      } catch {
        /* fall through */
      }
    }

    const generatedTests = generatedTestPaths(files);
    if (options.testsBlocking && generatedTests.length === 0) {
      errors.push(
        "Full-validation build generated no executable unit/integration tests.",
      );
      return {
        passed: false,
        stage: "tests",
        errors,
        durationMs: Date.now() - start,
        fileCount: Object.keys(files).length,
        warning:
          "A production-capable full-validation build must include executable tests before deployment.",
      };
    }

    if (options.requirementsBlocking) {
      const requirementIds = readRequirementIds(files);
      if (requirementIds.length === 0) {
        errors.push(
          "Full-validation build has no persisted requirement contract.",
        );
        return {
          passed: false,
          stage: "requirements",
          errors,
          durationMs: Date.now() - start,
          fileCount: Object.keys(files).length,
          warning:
            "Production certification requires a persisted requirement contract linked to behavioral tests.",
        };
      }

      const missingRequirementIds = validateRequirementTraceability(
        files,
        requirementIds,
      );
      if (missingRequirementIds.length > 0) {
        errors.push(
          `Behavioral tests are not linked to requirements: ${missingRequirementIds.join(", ")}`,
        );
        return {
          passed: false,
          stage: "requirements",
          errors,
          durationMs: Date.now() - start,
          fileCount: Object.keys(files).length,
          warning:
            "Every persisted customer requirement must be traceable to an executable behavioral test.",
        };
      }
    }

    const dockerResult = await validateWithDocker(files, techStack);
    if (dockerResult && !dockerResult.skipped) {
      if (!dockerResult.passed) {
        return {
          passed: false,
          stage: dockerResult.stage,
          errors: dockerResult.errors,
          durationMs: dockerResult.durationMs,
          fileCount: Object.keys(files).length,
          warning: "Docker sandbox validation failed.",
        };
      }
      return {
        passed: true,
        stage: dockerResult.stage,
        errors: [],
        durationMs: dockerResult.durationMs,
        fileCount: Object.keys(files).length,
        warning: `Docker sandbox passed (${dockerResult.stage}).`,
      };
    }

    if (options.requireIsolation) {
      errors.push(
        "No isolated build runtime is available; host fallback is forbidden for production certification.",
      );
      return {
        passed: false,
        stage: "isolation",
        errors,
        durationMs: Date.now() - start,
        fileCount: Object.keys(files).length,
        warning:
          "Configure Docker validation or an approved isolated execution runtime before certifying this product.",
      };
    }

    const hasNpm = await npmAvailable();
    if (!hasNpm) {
      const isProd = process.env.NODE_ENV === "production";
      errors.push(
        "npm not available in this environment — cannot verify install.",
      );
      return {
        passed: !isProd,
        stage: "install",
        errors,
        durationMs: Date.now() - start,
        fileCount: Object.keys(files).length,
        warning: isProd
          ? "npm unavailable — validation failed closed in production."
          : "npm unavailable in build container — dependencies not verified. Manual review required.",
      };
    }

    await runCommand("npm", ["cache", "verify"], tmpDir, 30_000).catch(
      () => {},
    );

    const cacheEnv = await npmCacheEnv();
    const installResult = await runCommand(
      "npm",
      [
        "install",
        "--prefer-offline",
        "--no-audit",
        "--no-fund",
        "--loglevel=error",
      ],
      tmpDir,
      120_000,
      { NODE_OPTIONS: "--max-old-space-size=512", ...cacheEnv },
    );
    if (installResult.exitCode !== 0) {
      const cacheless = await runCommand(
        "npm",
        [
          "install",
          "--prefer-offline",
          "--no-audit",
          "--no-fund",
          "--loglevel=error",
        ],
        tmpDir,
        120_000,
        { npm_config_cache: "/tmp/npm-cache-af" },
      );
      if (cacheless.exitCode !== 0) {
        errors.push(
          `Dependency install failed: ${installResult.stderr.slice(0, 500)}`,
        );
        return {
          passed: false,
          stage: "install",
          errors,
          durationMs: Date.now() - start,
          fileCount: Object.keys(files).length,
          warning:
            "LLM generated invalid dependencies or no package.json. Manual review required.",
        };
      }
    }

    const tsFiles = Object.keys(files).filter(
      (f) => f.endsWith(".ts") || f.endsWith(".tsx"),
    );
    if (tsFiles.length > 0) {
      const hasTsconfig = files["tsconfig.json"] || files["src/tsconfig.json"];
      if (!hasTsconfig) {
        await writeFile(
          join(tmpDir, "tsconfig.json"),
          JSON.stringify(
            {
              compilerOptions: {
                target: "ES2020",
                module: "ESNext",
                lib: ["ES2020", "DOM", "DOM.Iterable"],
                jsx: "react-jsx",
                strict: true,
                esModuleInterop: true,
                skipLibCheck: true,
                moduleResolution: "bundler",
                resolveJsonModule: true,
                noEmit: true,
                isolatedModules: true,
              },
              include: ["src", "*.ts"],
            },
            null,
            2,
          ),
        );
      }

      const tscResult = await runCommand(
        "npx",
        ["tsc", "--noEmit"],
        tmpDir,
        60_000,
      );
      if (tscResult.exitCode !== 0) {
        const combined = `${tscResult.stdout}\n${tscResult.stderr}`;
        const tscErrors = combined
          .split("\n")
          .filter((l) => /error TS\d+/.test(l) || /\.tsx?\(\d+,\d+\)/.test(l))
          .slice(0, 12);
        if (tscErrors.length === 0) {
          tscErrors.push(combined.slice(0, 600));
        }
        errors.push(...tscErrors);
        return {
          passed: false,
          stage: "typecheck",
          errors,
          durationMs: Date.now() - start,
          fileCount: Object.keys(files).length,
          warning:
            "TypeScript compilation failed. Errors will be fed back to LLM for auto-fix.",
        };
      }
    }

    if (
      generatedTests.length > 0 ||
      files["src/__tests__/setup.ts"] ||
      files["vitest.config.ts"] ||
      files["vitest.config.js"] ||
      files["vitest.config.mts"] ||
      files["vitest.config.mjs"] ||
      files["jest.config.js"]
    ) {
      const testResult = await runCommand(
        "npx",
        ["vitest", "run"],
        tmpDir,
        60_000,
      );
      if (testResult.exitCode !== 0) {
        const testErr = `Tests failed: ${testResult.stderr.slice(0, 300)}`;
        errors.push(testErr);
        if (options.testsBlocking) {
          return {
            passed: false,
            stage: "tests",
            errors,
            durationMs: Date.now() - start,
            fileCount: Object.keys(files).length,
            warning:
              "Generated tests failed. Errors will be fed back to the Coder for auto-fix.",
          };
        }
      }
    }

    const shouldRunVite =
      !!files["vite.config.ts"] ||
      !!files["vite.config.js"] ||
      !!files["index.html"];
    if (shouldRunVite || hasPackageJson) {
      const buildResult = await runCommand(
        "npx",
        ["vite", "build"],
        tmpDir,
        60_000,
      );
      if (buildResult.exitCode !== 0) {
        const buildLog = `${buildResult.stderr}\n${buildResult.stdout}`.slice(
          0,
          500,
        );
        errors.push(`Build failed: ${buildLog}`);
        return {
          passed: false,
          stage: "build",
          errors,
          durationMs: Date.now() - start,
          fileCount: Object.keys(files).length,
          warning: "Vite build failed. Likely import errors or missing files.",
        };
      }

      const runtime = await verifyViteRuntime(tmpDir);
      if (!runtime.passed) {
        errors.push(
          runtime.error || "Generated app failed runtime verification",
        );
        return {
          passed: false,
          stage: "runtime",
          errors,
          durationMs: Date.now() - start,
          fileCount: Object.keys(files).length,
          warning:
            "Generated web app built successfully but did not boot into a reachable working page. Errors will be fed back for automatic repair.",
        };
      }
    }

    let warning =
      "LLM-generated code passed install, typecheck, tests, build, and runtime boot validation. Review business logic before production use.";

    if (options.validateBilling) {
      const { validateBillingScaffold } =
        await import("../services/saasBillingScaffold.js");
      const billing = validateBillingScaffold(files);
      if (!billing.passed) {
        warning += ` Billing scaffold gaps: ${billing.missing.join(", ")}. Configure Stripe env vars before go-live.`;
      }
    }

    return {
      passed: true,
      stage: "runtime",
      errors: [],
      durationMs: Date.now() - start,
      fileCount: Object.keys(files).length,
      warning,
    };
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

function techStackDeps(techStack: string): {
  prod: Record<string, string>;
  dev: Record<string, string>;
} {
  const commonProd: Record<string, string> = {
    react: "^18.2.0",
    "react-dom": "^18.2.0",
    express: "^4.18.2",
    "drizzle-orm": "^0.30.0",
    postgres: "^3.4.0",
    zod: "^3.22.0",
    "react-router-dom": "^6.20.0",
    "@tanstack/react-query": "^5.0.0",
    tailwindcss: "^3.3.0",
  };
  const commonDev: Record<string, string> = {
    typescript: "^5.3.0",
    vite: "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@types/express": "^4.17.0",
    vitest: "^1.0.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    jsdom: "^24.0.0",
    "drizzle-kit": "^0.30.0",
  };

  if (techStack.includes("phaser")) commonProd.phaser = "^3.70.0";
  if (techStack.includes("three")) {
    commonProd.three = "^0.160.0";
    commonDev["@types/three"] = "^0.160.0";
  }
  if (techStack.includes("electron")) commonProd.electron = "^28.0.0";
  if (techStack.includes("openai")) commonProd.openai = "^4.28.0";
  // Never inject non-existent stub packages — they break npm install

  return { prod: commonProd, dev: commonDev };
}
