import { afterEach, describe, expect, it } from "vitest";
import { validateGeneratedBuild } from "../agents/buildValidator.js";
import { getStackScaffold } from "../services/stackScaffolds.js";

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  DOCKER_VALIDATION: process.env.DOCKER_VALIDATION,
  SPRITES_BUILD_URL: process.env.SPRITES_BUILD_URL,
  SPRITES_EXEC_URL: process.env.SPRITES_EXEC_URL,
  SPRITES_API_TOKEN: process.env.SPRITES_API_TOKEN,
};

function restore(name: keyof typeof ORIGINAL_ENV): void {
  const value = ORIGINAL_ENV[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  restore("NODE_ENV");
  restore("DOCKER_VALIDATION");
  restore("SPRITES_BUILD_URL");
  restore("SPRITES_EXEC_URL");
  restore("SPRITES_API_TOKEN");
});

function disableIsolationRuntimes(): void {
  process.env.NODE_ENV = "production";
  process.env.DOCKER_VALIDATION = "false";
  delete process.env.SPRITES_BUILD_URL;
  delete process.env.SPRITES_EXEC_URL;
  delete process.env.SPRITES_API_TOKEN;
}

describe("#16 production build isolation", () => {
  it("fails closed for Python before host-side syntax execution", async () => {
    disableIsolationRuntimes();
    const files = getStackScaffold("python-service", "api");

    const result = await validateGeneratedBuild(files, "python-service");

    expect(result.passed).toBe(false);
    expect(result.stage).toBe("isolation");
    expect(result.errors.join(" ")).toMatch(/may not execute generated code on the AppForge host/i);
  });

  it("fails closed for Flutter instead of returning a structural production pass", async () => {
    disableIsolationRuntimes();
    const files = getStackScaffold("flutter-firebase", "mobile_app");

    const result = await validateGeneratedBuild(files, "flutter-firebase");

    expect(result.passed).toBe(false);
    expect(result.stage).toBe("isolation");
  });

  it("fails closed for browser extensions instead of returning a structural production pass", async () => {
    disableIsolationRuntimes();
    const files = getStackScaffold("chrome-extension", "browser_extension");

    const result = await validateGeneratedBuild(files, "chrome-extension");

    expect(result.passed).toBe(false);
    expect(result.stage).toBe("isolation");
  });
});
