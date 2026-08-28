import { spawn } from "child_process";
import { mkdir, writeFile, rm } from "fs/promises";
import { join, extname } from "path";
import { tmpdir } from "os";

export type FileValidationResult = {
  ok: boolean;
  message: string;
};

function run(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<{ exitCode: number; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, shell: false });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({ exitCode: 1, stderr: stderr + "\n[TIMEOUT]" });
    }, timeoutMs);
    child.stderr?.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code ?? 1, stderr });
    });
  });
}

export async function validateSingleFile(
  path: string,
  content: string,
  allFiles: Record<string, string>,
): Promise<FileValidationResult> {
  const ext = extname(path).toLowerCase();
  const tmpDir = join(tmpdir(), `appforge-file-${Date.now()}`);
  try {
    await mkdir(tmpDir, { recursive: true });
    for (const [p, c] of Object.entries(allFiles)) {
      const full = join(tmpDir, p);
      await mkdir(join(full, ".."), { recursive: true });
      await writeFile(full, c, "utf-8");
    }
    await writeFile(join(tmpDir, path), content, "utf-8");

    if (ext === ".py") {
      const r = await run(
        "python3",
        ["-m", "py_compile", path],
        tmpDir,
        20_000,
      );
      return r.exitCode === 0
        ? { ok: true, message: "Python syntax OK" }
        : { ok: false, message: r.stderr.slice(0, 300) || "Syntax error" };
    }

    if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
      if (!allFiles["package.json"] && !allFiles["tsconfig.json"]) {
        return {
          ok: true,
          message: "Saved (no tsconfig in project for isolated check)",
        };
      }
      const r = await run("npx", ["tsc", "--noEmit", path], tmpDir, 45_000);
      return r.exitCode === 0
        ? { ok: true, message: "TypeScript check passed" }
        : { ok: false, message: r.stderr.slice(0, 400) || "Type error" };
    }

    if (ext === ".json") {
      try {
        JSON.parse(content);
        return { ok: true, message: "Valid JSON" };
      } catch (e) {
        return {
          ok: false,
          message: e instanceof Error ? e.message : "Invalid JSON",
        };
      }
    }

    return { ok: true, message: "File saved (no validator for this type)" };
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
