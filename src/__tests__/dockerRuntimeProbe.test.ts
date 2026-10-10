import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NODE_RUNTIME_PROBE } from "../lib/dockerRuntimeProbe.js";

async function probe(source: string, limit: number) {
  const dir = await mkdtemp(join(tmpdir(), "appforge-runtime-test-"));
  const listener = createServer();
  await new Promise<void>((resolve) =>
    listener.listen(0, "127.0.0.1", resolve),
  );
  const address = listener.address();
  if (!address || typeof address === "string")
    throw new Error("No fixture port");
  const port = address.port;
  await new Promise<void>((resolve) => listener.close(() => resolve()));
  await writeFile(
    join(dir, "package.json"),
    JSON.stringify({ scripts: { start: "node app.cjs" } }),
  );
  await writeFile(join(dir, "app.cjs"), source);
  const child = spawn(
    process.execPath,
    ["--disable-sigusr1", "-e", NODE_RUNTIME_PROBE],
    {
      cwd: dir,
      detached: true,
      env: {
        PATH: process.env.PATH,
        HOME: dir,
        APPFORGE_VALIDATION_PORT: String(port),
        APPFORGE_RUNTIME_TIMEOUT_MS: String(limit),
      },
    },
  );
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  try {
    const exit = await new Promise<number | null>((resolve, reject) => {
      child.on("exit", resolve);
      child.on("error", reject);
    });
    return { exit, output };
  } finally {
    // Fixtures run locally, outside Docker: clean up the entire owned group.
    try {
      process.kill(-child.pid!, "SIGKILL");
    } catch {
      // The probe may already have stopped its entire process group.
    }
    await rm(dir, { recursive: true, force: true });
  }
}

describe("actual Node runtime evidence", () => {
  it("accepts a real successful HTTP startup", async () => {
    const result = await probe(
      "require('node:http').createServer((_req,res) => { res.writeHead(200); res.end('healthy'); }).listen(Number(process.env.PORT),'127.0.0.1');",
      5000,
    );
    expect(result.exit).toBe(0);
    expect(result.output).toContain("successful HTTP response");
  }, 10000);
  it("rejects successful command exit without a running product", async () => {
    const result = await probe("process.exit(0);", 1500);
    expect(result.exit).toBe(1);
  }, 5000);
  it("rejects a running process that only serves errors", async () => {
    const result = await probe(
      "require('node:http').createServer((_req,res) => { res.writeHead(500); res.end('broken'); }).listen(Number(process.env.PORT),'127.0.0.1');",
      1500,
    );
    expect(result.exit).toBe(1);
  }, 5000);
});
