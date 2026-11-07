import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { zipFiles } from "../services/deployer.js";

describe("project source ZIP export", () => {
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
