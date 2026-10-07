import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isolatedBuildConfigured,
  validateWithIsolatedBuildRunner,
} from "../services/isolatedBuildRunner";

const originalEnv = { ...process.env };

function artifactSha256(files: Record<string, string>): string {
  return createHash("sha256").update(JSON.stringify(files)).digest("hex");
}

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
});

describe("isolated production build runner", () => {
  it("requires both an execution URL and token", () => {
    delete process.env.SPRITES_BUILD_URL;
    delete process.env.SPRITES_EXEC_URL;
    delete process.env.SPRITES_API_TOKEN;
    expect(isolatedBuildConfigured()).toBe(false);
    process.env.SPRITES_BUILD_URL = "https://sprites.example.test/build";
    process.env.SPRITES_API_TOKEN = "secret";
    expect(isolatedBuildConfigured()).toBe(true);
  });

  it("accepts success only with install, security, test, build, runtime, and exact-artifact evidence", async () => {
    process.env.NODE_ENV = "production";
    process.env.SPRITES_BUILD_URL = "https://sprites.example.test/build";
    process.env.SPRITES_API_TOKEN = "secret";
    const files = { "package.json": "{}" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            passed: true,
            stage: "isolated_runtime",
            isolationId: "sandbox-123",
            artifactSha256: artifactSha256(files),
            techStack: "react-node",
            steps: {
              install: { passed: true },
              security: { passed: true },
              tests: { passed: true },
              build: { passed: true },
              runtime: { passed: true },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const result = await validateWithIsolatedBuildRunner(files, "react-node");
    expect(result).toMatchObject({
      passed: true,
      isolationId: "sandbox-123",
    });
  });

  it("rejects a false green missing runtime proof", async () => {
    process.env.NODE_ENV = "production";
    process.env.SPRITES_BUILD_URL = "https://sprites.example.test/build";
    process.env.SPRITES_API_TOKEN = "secret";
    const files = { "package.json": "{}" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            passed: true,
            isolationId: "sandbox-123",
            artifactSha256: artifactSha256(files),
            techStack: "react-node",
            steps: {
              install: { passed: true },
              security: { passed: true },
              tests: { passed: true },
              build: { passed: true },
            },
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(
      validateWithIsolatedBuildRunner(files, "react-node"),
    ).rejects.toThrow("claimed success without passing: runtime");
  });

  it("rejects success proof for a different artifact or stack", async () => {
    process.env.NODE_ENV = "production";
    process.env.SPRITES_BUILD_URL = "https://sprites.example.test/build";
    process.env.SPRITES_API_TOKEN = "secret";
    const files = { "package.json": "{}" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            passed: true,
            isolationId: "sandbox-stale",
            artifactSha256: "stale-artifact-proof",
            techStack: "next-node",
            steps: {
              install: { passed: true },
              security: { passed: true },
              tests: { passed: true },
              build: { passed: true },
              runtime: { passed: true },
            },
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(
      validateWithIsolatedBuildRunner(files, "react-node"),
    ).rejects.toThrow("proof does not match the generated artifact");
  });
});