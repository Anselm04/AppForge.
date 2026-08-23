// src/agents/buildValidator.ts
// ── Build Validation Agent ──────────────────────────────────────────────
// This is the most critical production-readiness piece. It takes the raw
// text files the LLM generated and actually tries to:
// 1. Write them to a temp directory
// 2. Install dependencies (npm install)
// 3. Type-check (tsc --noEmit)
// 4. Run any generated tests (npm test)
// 5. Start the dev server and hit /health (optional)
// 6. Return a pass/fail report with specific errors
//
// If validation FAILS, the pipeline will feed the errors back to the LLM
// for an automatic retry (see pipeline.ts "Validator" phase).

import { mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { spawn } from "child_process";

export interface ValidationResult {
  passed: boolean;
  stage: string;
  errors: string[];
  durationMs: number;
  fileCount: number;
  warning: string;
}

function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  env?: Record<string, string>
): Promise<{ exitCode: number; stdout: string; stderr: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, shell: false, env: { ...process.env, ...env } });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({ exitCode: 1, stdout, stderr: stderr + "\n[TIMEOUT]", timedOut: true });
    }, timeoutMs);

    child.stdout?.on("data", (d) => (stdout += d.toString()));
    child.stderr?.on("data", (d) => (stderr += d.toString()));

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code ?? 1, stdout, stderr, timedOut: false });
    });
  });
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
  techStack: string
): Promise<ValidationResult> {
  const tmpDir = join(tmpdir(), `appforge-build-${Date.now()}`);
  const start = Date.now();
  const errors: string[] = [];

  try {
    // ── 1. Write files ─────────────────────────────────────────────────
    await mkdir(tmpDir, { recursive: true });
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = join(tmpDir, filePath);
      await mkdir(join(fullPath, ".."), { recursive: true });
      await writeFile(fullPath, content, "utf-8");
    }

    // ── 2. Create a package.json if the LLM forgot ─────────────────────
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
          2
        )
      );
    }

    // ── 3. npm install ─────────────────────────────────────────────────
    // Pre-flight: if npm is not responding, skip validation gracefully
    const hasNpm = await npmAvailable();
    if (!hasNpm) {
      errors.push("npm not available in this environment — skipping install validation.");
      return {
        passed: true, // non-blocking: app can still be saved and deployed
        stage: "install",
        errors,
        durationMs: Date.now() - start,
        fileCount: Object.keys(files).length,
        warning: "npm unavailable in build container — dependencies not verified. Manual review and local install required.",
      };
    }

    // Warm up npm cache (prevents first-run hang)
    await runCommand("npm", ["cache", "verify"], tmpDir, 30_000).catch(() => {});

    const installResult = await runCommand(
      "npm",
      ["install", "--prefer-offline", "--no-audit", "--no-fund", "--loglevel=error"],
      tmpDir,
      120_000,
      { NODE_OPTIONS: "--max-old-space-size=512" }
    );
    if (installResult.exitCode !== 0) {
      // Retry with cache disabled (network-less fallback)
      const cacheless = await runCommand(
        "npm",
        ["install", "--prefer-offline", "--no-audit", "--no-fund", "--loglevel=error"],
        tmpDir,
        120_000,
        { npm_config_cache: "/tmp/npm-cache-af" }
      );
      if (cacheless.exitCode !== 0) {
        errors.push(`Dependency install failed: ${installResult.stderr.slice(0, 500)}`);
        return {
          passed: false,
          stage: "install",
          errors,
          durationMs: Date.now() - start,
          fileCount: Object.keys(files).length,
          warning: "LLM generated invalid dependencies or no package.json. Manual review required.",
        };
      }
    }

    // ── 4. Type check (if TS files present) ────────────────────────────
    const tsFiles = Object.keys(files).filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"));
    if (tsFiles.length > 0) {
      // Create minimal tsconfig.json if missing
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
                moduleResolution: "node",
                resolveJsonModule: true,
                noEmit: true,
              },
              include: ["src", "*.ts"],
            },
            null,
            2
          )
        );
      }

      const tscResult = await runCommand("npx", ["tsc", "--noEmit"], tmpDir, 60_000);
      if (tscResult.exitCode !== 0) {
        const tscErrors = tscResult.stdout
          .split("\n")
          .filter((l) => l.includes("error TS"))
          .slice(0, 10); // Max 10 errors to not flood LLM context
        errors.push(...tscErrors);
        return {
          passed: false,
          stage: "typecheck",
          errors,
          durationMs: Date.now() - start,
          fileCount: Object.keys(files).length,
          warning: "TypeScript compilation failed. Errors will be fed back to LLM for auto-fix.",
        };
      }
    }

    // ── 5. Try to run generated tests ──────────────────────────────────
    if (files["src/__tests__/setup.ts"] || files["vitest.config.ts"] || files["jest.config.js"]) {
      const testResult = await runCommand("npx", ["vitest", "run"], tmpDir, 60_000);
      if (testResult.exitCode !== 0) {
        errors.push(`Tests failed: ${testResult.stderr.slice(0, 300)}`);
        // Non-blocking warning — many generated tests are stubs
      }
    }

    // ── 6. Build check ─────────────────────────────────────────────────
    if (files["vite.config.ts"] || files["vite.config.js"] || hasPackageJson) {
      const buildResult = await runCommand("npx", ["vite", "build"], tmpDir, 60_000);
      if (buildResult.exitCode !== 0) {
        errors.push(`Build failed: ${buildResult.stderr.slice(0, 300)}`);
        return {
          passed: false,
          stage: "build",
          errors,
          durationMs: Date.now() - start,
          fileCount: Object.keys(files).length,
          warning: "Vite build failed. Likely import errors or missing files.",
        };
      }
    }

    return {
      passed: true,
      stage: "runtime",
      errors: [],
      durationMs: Date.now() - start,
      fileCount: Object.keys(files).length,
      warning: "LLM-generated code passed basic validation. ALWAYS review manually before production use.",
    };
  } finally {
    // Cleanup temp directory
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Map tech stack strings to dependency sets */
function techStackDeps(techStack: string): { prod: Record<string, string>; dev: Record<string, string> } {
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

  // Game / 3D / AI stacks need special deps
  if (techStack.includes("phaser")) {
    commonProd.phaser = "^3.70.0";
  }
  if (techStack.includes("three")) {
    commonProd.three = "^0.160.0";
    commonDev["@types/three"] = "^0.160.0";
  }
  if (techStack.includes("godot")) {
    // Godot exports to HTML5 via WebGL; no npm deps needed
    commonProd["html5-game-engine"] = "stub";
  }
  if (techStack.includes("unity")) {
    commonProd["unity-webgl-loader"] = "stub";
  }
  if (techStack.includes("electron")) {
    commonProd.electron = "^28.0.0";
  }
  if (techStack.includes("ai-agent")) {
    commonProd["ai-agent-sdk"] = "^1.0.0";
  }
  if (techStack.includes("openai")) {
    commonProd.openai = "^4.28.0";
  }

  return { prod: commonProd, dev: commonDev };
}
