import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isolatedBuildConfigured,
  validateWithIsolatedBuildRunner,
} from "../services/isolatedBuildRunner";

const originalEnv = { ...process.env };

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

  it("accepts success only with install, test, build, and runtime evidence", async () => {
    process.env.NODE_ENV = "production";
    process.env.SPRITES_BUILD_URL = "https://sprites.example.test/build";
    process.env.SPRITES_API_TOKEN = "secret";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            passed: true,
            stage: "isolated_runtime",
            isolationId: "sandbox-123",
            steps: {
              install: { passed: true },
              tests: { passed: true },
              build: { passed: true },
              runtime: { passed: true },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const result = await validateWithIsolatedBuildRunner(
      { "package.json": "{}" },
      "react-node",
    );
    expect(result).toMatchObject({
      passed: true,
      isolationId: "sandbox-123",
    });
  });

  it("rejects a false green missing runtime proof", async () => {
    process.env.NODE_ENV = "production";
    process.env.SPRITES_BUILD_URL = "https://sprites.example.test/build";
    process.env.SPRITES_API_TOKEN = "secret";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            passed: true,
            isolationId: "sandbox-123",
            steps: {
              install: { passed: true },
              tests: { passed: true },
              build: { passed: true },
            },
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(
      validateWithIsolatedBuildRunner({ "package.json": "{}" }, "react-node"),
    ).rejects.toThrow("claimed success without passing: runtime");
  });
});
