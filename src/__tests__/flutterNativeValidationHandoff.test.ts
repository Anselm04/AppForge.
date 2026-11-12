import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStackScaffold } from "../services/stackScaffolds.js";

const mockedRunner = vi.hoisted(() => ({
  validateWithIsolatedBuildRunner: vi.fn(),
  isolatedBuildConfigured: vi.fn(() => false),
}));

vi.mock("../services/isolatedBuildRunner.js", () => mockedRunner);

import { validateGeneratedBuild } from "../agents/buildValidator.js";

describe("Flutter native validation handoff", () => {
  beforeEach(() => {
    mockedRunner.validateWithIsolatedBuildRunner.mockReset();
    mockedRunner.validateWithIsolatedBuildRunner.mockResolvedValue(null);
  });

  it("labels unexecuted Flutter code as structural-only", async () => {
    const files = getStackScaffold("flutter-node", "mobile_app");
    const result = await validateGeneratedBuild(files, "flutter-node");
    expect(result.stage).toBe("structure");
    expect(result.warning).toContain("No native analyzer");
    expect(mockedRunner.validateWithIsolatedBuildRunner).toHaveBeenCalled();
  });

  it("reports the actual isolated runner result instead of claiming source-only proof", async () => {
    mockedRunner.validateWithIsolatedBuildRunner.mockResolvedValue({
      passed: false,
      stage: "native_build",
      errors: ["flutter build apk failed"],
      durationMs: 250,
      isolationId: "native-run-123",
    });
    const files = getStackScaffold("flutter-node", "mobile_app");
    const result = await validateGeneratedBuild(files, "flutter-node");
    expect(result.passed).toBe(false);
    expect(result.stage).toBe("native_build");
    expect(result.errors).toContain("flutter build apk failed");
  });
});
