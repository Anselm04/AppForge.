import { beforeEach, describe, expect, it, vi } from "vitest";

const persistence = vi.hoisted(() => ({
  files: vi.fn(),
  status: vi.fn(),
}));
vi.mock("../db.js", () => ({
  updateProjectFiles: persistence.files,
  updateProjectStatus: persistence.status,
}));
import { pauseUnavailableValidation } from "../services/buildValidationPause.js";
import { isRecoverableBuildPause } from "../lib/buildRecovery.js";

const files = {
  "README.md": "saved owner edit",
  "src/App.test.tsx": "new test",
};
const result = {
  passed: false,
  stage: "isolation",
  errors: ["No isolated build runner was available."],
  durationMs: 25,
  fileCount: 2,
  warning: "Configure an isolated runner.",
};

beforeEach(() => {
  vi.resetAllMocks();
  persistence.files.mockResolvedValue({ artifactVersion: 3 });
  persistence.status.mockResolvedValue(undefined);
});

describe("unavailable validation infrastructure", () => {
  it("preserves the working files and pauses before permitting another repair", async () => {
    const write = vi.fn();
    await expect(
      pauseUnavailableValidation({ projectId: 68, files, result, write }),
    ).resolves.toBe(true);
    expect(persistence.files).toHaveBeenCalledWith(68, files);
    expect(persistence.status).toHaveBeenCalledWith(
      68,
      "paused",
      "validation_unavailable",
    );
    expect(write).toHaveBeenCalledWith(
      "pause",
      expect.objectContaining({
        reason: "validation_unavailable",
        agent: "Validator",
        errors: result.errors,
        message: expect.stringMatching(/saved.*retry.*available/i),
      }),
    );
    expect(isRecoverableBuildPause("paused", "validation_unavailable")).toBe(
      true,
    );
  });
  it.each([
    { ...result, stage: "tests" },
    { ...result, stage: "security" },
    { ...result, passed: true },
  ])(
    "leaves ordinary code failures and successful validations in their normal path: %j",
    async (validation) => {
      const write = vi.fn();
      expect(
        await pauseUnavailableValidation({
          projectId: 68,
          files,
          result: validation,
          write,
        }),
      ).toBe(false);
      expect(persistence.files).not.toHaveBeenCalled();
      expect(persistence.status).not.toHaveBeenCalled();
      expect(write).not.toHaveBeenCalled();
    },
  );
  it("never reports progress saved if persistence failed", async () => {
    persistence.files.mockRejectedValue(new Error("database unavailable"));
    const write = vi.fn();
    await expect(
      pauseUnavailableValidation({ projectId: 68, files, result, write }),
    ).rejects.toThrow("database unavailable");
    expect(persistence.status).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });
});
