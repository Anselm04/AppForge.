import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  assertArtifactMatchesWorkingFiles,
  zipFiles,
} from "../services/deployer.js";

const staleFileCases: Array<{
  workingFiles: Record<string, string>;
  validatedFiles: Record<string, string>;
}> = [
  {
    workingFiles: { "src/App.tsx": "edited" },
    validatedFiles: { "src/App.tsx": "validated" },
  },
  {
    workingFiles: {
      "src/App.tsx": "validated",
      "src/Feature.tsx": "new",
    },
    validatedFiles: { "src/App.tsx": "validated" },
  },
  {
    workingFiles: {},
    validatedFiles: { "src/App.tsx": "deleted from working source" },
  },
];

describe("project source ZIP export", () => {
  it("allows export when working source matches the validated artifact", () => {
    const files = { "src/App.tsx": "export const app = true;" };

    expect(() =>
      assertArtifactMatchesWorkingFiles({
        workingFiles: files,
        validatedFiles: files,
      }),
    ).not.toThrow();
  });

  it.each(staleFileCases)(
    "blocks export when saved files differ from the validated artifact",
    (input) => {
      expect(() => assertArtifactMatchesWorkingFiles(input)).toThrow(
        "Saved project edits are unvalidated",
      );
    },
  );

  it("preserves source files in a downloadable archive", async () => {
    const result = await zipFiles("Task Tracker", {
      "src/App.tsx": "export const app = true;",
      "README.md": "# Task Tracker",
    });
    const archive = await JSZip.loadAsync(Buffer.from(result.base64, "base64"));

    expect(result.filename).toBe("task-tracker-appforge.zip");
    expect(await archive.file("src/App.tsx")?.async("string")).toBe(
      "export const app = true;",
    );
    expect(await archive.file("README.md")?.async("string")).toBe(
      "# Task Tracker",
    );
  });

  it.each([
    "../outside.txt",
    "/absolute.txt",
    "C:/outside.txt",
    "src\\..\\outside.txt",
    "src/\0outside.txt",
  ])("rejects unsafe archive path %s", async (path) => {
    await expect(zipFiles("Project", { [path]: "content" })).rejects.toThrow(
      "Unsafe project export path",
    );
  });
});
