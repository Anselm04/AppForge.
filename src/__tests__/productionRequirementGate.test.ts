import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const runner = vi.hoisted(() => ({
  validateWithIsolatedBuildRunner: vi.fn(),
  isolatedBuildConfigured: vi.fn(() => true),
}));
vi.mock("../services/isolatedBuildRunner.js", () => runner);
import { validateGeneratedBuild } from "../agents/buildValidator.js";
import { getStackScaffold } from "../services/stackScaffolds.js";
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  runner.validateWithIsolatedBuildRunner.mockReset().mockResolvedValue({
    passed: true,
    stage: "complete",
    errors: [],
    durationMs: 1,
    isolationId: "reviewed-fixture",
  });
});
afterEach(() => vi.unstubAllEnvs());
const manifest = JSON.stringify({
  version: 1,
  requirements: [
    { id: "REQ-001", text: "Adding a task retains previous tasks" },
  ],
});
function fixture() {
  const files = getStackScaffold("react-node", "saas_application");
  for (const path of Object.keys(files))
    if (/test|spec/.test(path)) delete files[path];
  files["appforge.requirements.json"] = manifest;
  return files;
}
describe("production full-build acceptance gates", () => {
  it("rejects full validation without executable tests before contacting a runner", async () => {
    const result = await validateGeneratedBuild(fixture(), "react-node", {
      testsBlocking: true,
    });
    expect(result.passed).toBe(false);
    expect(result.stage).toBe("tests");
    expect(runner.validateWithIsolatedBuildRunner).not.toHaveBeenCalled();
  });
  it("rejects tests that omit requirement links even if a runner would pass", async () => {
    const files = {
      ...fixture(),
      "task.test.cjs":
        "require('node:test')('addition',()=>require('node:assert/strict').equal(1+1,2));",
    };
    const result = await validateGeneratedBuild(files, "react-node", {
      testsBlocking: true,
    });
    expect(result.passed).toBe(false);
    expect(result.stage).toBe("requirements");
    expect(runner.validateWithIsolatedBuildRunner).not.toHaveBeenCalled();
  });
  it("allows linked native Node tests to proceed to isolated execution", async () => {
    const files = {
      ...fixture(),
      "task.test.cjs":
        "// requirement: REQ-001\nrequire('node:test')('addition',()=>require('node:assert/strict').equal(1+1,2));",
    };
    const result = await validateGeneratedBuild(files, "react-node", {
      testsBlocking: true,
    });
    expect(result.passed).toBe(true);
    expect(runner.validateWithIsolatedBuildRunner).toHaveBeenCalledWith(
      files,
      "react-node",
    );
  });
});
