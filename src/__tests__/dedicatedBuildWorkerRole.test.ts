import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("dedicated build worker runtime contract", () => {
  const api = readFileSync("src/server.ts", "utf8");
  const worker = readFileSync("src/services/build-worker-entry.ts", "utf8");
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  const tsconfig = JSON.parse(readFileSync("tsconfig.server.json", "utf8"));

  it("does not start BullMQ consumers in API-only mode", () => {
    expect(api).toContain(
      'process.env.APPFORGE_BUILD_WORKER_MODE !== "external"',
    );
    expect(api).toContain("startBuildQueueWorker(2000)");
  });

  it("keeps a dedicated worker entry in the server build", () => {
    expect(tsconfig.include).toContain("src/services/**/*.ts");
    expect(packageJson.scripts["start:build-worker"]).toBe(
      "node dist/services/build-worker-entry.js",
    );
    expect(worker).toContain("startBuildQueueWorker(2000)");
    expect(worker).toContain("await ensureAppSchema()");
    expect(worker).toContain("await checkSharedRedis()");
    expect(worker).toContain("Dedicated build workers require REDIS_URL");
    expect(worker).not.toContain("app.listen(");
  });
});
