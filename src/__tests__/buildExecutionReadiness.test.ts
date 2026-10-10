import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const docker = vi.hoisted(() => ({ dockerBuildAvailable: vi.fn() }));
vi.mock("../lib/dockerValidator.js", () => docker);
import {
  assertBuildExecutionReady,
  BuildRuntimeUnavailableError,
} from "../services/buildExecutionReadiness.js";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  for (const name of [
    "ISOLATED_BUILD_URL",
    "ISOLATED_PREVIEW_URL",
    "ISOLATED_EXEC_URL",
    "ISOLATED_HEALTH_URL",
    "ISOLATED_RUNTIME_TOKEN",
    "SPRITES_BUILD_URL",
    "SPRITES_EXEC_URL",
    "SPRITES_API_TOKEN",
  ])
    vi.stubEnv(name, "");
  vi.stubEnv("SPRITES_DISABLED", "true");
  docker.dockerBuildAvailable.mockReset().mockResolvedValue(false);
});
afterEach(() => vi.unstubAllEnvs());

describe("build execution preflight", () => {
  it("refuses unavailable production execution before work starts", async () => {
    await expect(assertBuildExecutionReady()).rejects.toBeInstanceOf(
      BuildRuntimeUnavailableError,
    );
  });
  it("allows an approved HTTPS build endpoint without executing customer code", async () => {
    vi.stubEnv("ISOLATED_BUILD_URL", "https://approved.example/validate");
    vi.stubEnv("ISOLATED_RUNTIME_TOKEN", "synthetic-token");
    await expect(assertBuildExecutionReady()).resolves.toBeUndefined();
    expect(docker.dockerBuildAvailable).not.toHaveBeenCalled();
  });
  it.each([
    "http://approved.example/validate",
    "https://user:secret@approved.example/validate",
    "https://runtime.sprites.app/validate",
    "not a URL",
  ])("rejects unsafe configuration %s", async (url) => {
    vi.stubEnv("ISOLATED_BUILD_URL", url);
    vi.stubEnv("ISOLATED_RUNTIME_TOKEN", "synthetic-token");
    docker.dockerBuildAvailable.mockResolvedValue(true);
    await expect(assertBuildExecutionReady()).rejects.toBeInstanceOf(
      BuildRuntimeUnavailableError,
    );
  });
  it("does not fall back to metered legacy execution with partial generic configuration", async () => {
    vi.stubEnv("ISOLATED_PREVIEW_URL", "https://approved.example/preview");
    vi.stubEnv("SPRITES_BUILD_URL", "https://runtime.sprites.app/validate");
    vi.stubEnv("SPRITES_API_TOKEN", "synthetic-token");
    await expect(assertBuildExecutionReady()).rejects.toBeInstanceOf(
      BuildRuntimeUnavailableError,
    );
  });
  it("allows verified local Docker availability", async () => {
    docker.dockerBuildAvailable.mockResolvedValue(true);
    await expect(assertBuildExecutionReady()).resolves.toBeUndefined();
  });
  it("preserves development execution", async () => {
    vi.stubEnv("NODE_ENV", "test");
    await expect(assertBuildExecutionReady()).resolves.toBeUndefined();
    expect(docker.dockerBuildAvailable).not.toHaveBeenCalled();
  });
});
