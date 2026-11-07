import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("visual editor working revision", () => {
  it("reads the latest editable files and saves through the concurrent-safe snapshot service", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/routers/visualEditor.ts"),
      "utf8",
    );
    expect(source).toContain("getEditableProjectFiles(input.projectId)");
    expect(source).toContain("commitValidatedProjectFileEdit({");
    expect(source).not.toContain("getProjectFiles(input.projectId)");
    expect(source).toContain("project.userId !== ctx.user.id");
  });
});
