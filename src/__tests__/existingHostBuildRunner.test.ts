import { afterEach, describe, expect, it, vi } from "vitest";
import {
  existingHostBuildReady,
  validateWithExistingHost,
} from "../services/existingHostBuildRunner.js";
afterEach(() => vi.unstubAllEnvs());
describe("existing-host production adapter", () => {
  it("does not load or invoke the runner unless explicitly enabled", async () => {
    vi.stubEnv("EXISTING_HOST_SANDBOX_ENABLED", "false");
    expect(await existingHostBuildReady()).toBe(false);
    expect(await validateWithExistingHost({}, "node-service")).toBeNull();
  });
  it("refuses enabled execution when the host has not been prepared", async () => {
    vi.stubEnv("EXISTING_HOST_SANDBOX_ENABLED", "true");
    vi.stubEnv("APPFORGE_SANDBOX_PREPARED", "false");
    expect(await existingHostBuildReady()).toBe(false);
    const proof = await validateWithExistingHost(
      {
        "package.json": JSON.stringify({
          scripts: {
            test: "node --test",
            build: "node build.cjs",
            start: "node server.cjs",
          },
        }),
      },
      "react-node",
    );
    expect(proof?.passed).toBe(false);
    expect(proof?.stage).toBe("isolation");
    expect(proof?.steps).toEqual({});
  });
  it("rejects raw header identity before creating any sandbox", async () => {
    vi.stubEnv("EXISTING_HOST_SANDBOX_ENABLED", "true");
    const proof = await validateWithExistingHost(
      {
        "server/index.js":
          "req.user = { id: req.headers['x-user-id'] || 'anonymous' };",
      },
      "react-node",
    );
    expect(proof?.passed).toBe(false);
    expect(proof?.stage).toBe("security");
    expect(proof?.isolationId).toBe("");
  });
});
