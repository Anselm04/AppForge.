import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Senior Dev project change preservation", () => {
  it("starts from working source and rejects stale concurrent results", () => {
    const source = readFileSync("src/services/seniorDevExecution.ts", "utf8");
    expect(source).toContain("getEditableProjectFiles(task.projectId)");
    expect(source).toContain("commitValidatedProjectFilesEdit({");
    expect(source).toContain("originalFiles,");
    expect(source).not.toContain(
      "updateProjectFiles(task.projectId, result.files)",
    );
    expect(source).not.toContain("project.generatedFiles as Record");
  });
});
