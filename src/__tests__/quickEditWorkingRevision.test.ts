import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("chat edits preserve saved working revisions", () => {
  it("writes through the conflict-checked snapshot and never a stale artifact", () => {
    const quick = readFileSync("src/services/quickEditAgent.ts", "utf8");
    const chat = readFileSync("src/routers/projectChat.ts", "utf8");
    const edits = readFileSync("src/services/projectFileEdits.ts", "utf8");
    expect(quick).toContain("getEditableProjectFiles(params.projectId)");
    expect(quick).toContain("commitValidatedProjectFilesEdit({");
    expect(quick).not.toContain("updateProjectFiles(params.projectId");
    expect(quick).toContain("if (!outcome.rolledBack)");
    expect(chat).toContain("getEditableProjectFiles(input.projectId)");
    expect(chat).toContain("userId: ctx.user.id,");
    expect(edits).toContain("Saved files changed during this edit.");
    expect(edits).toContain(
      "export async function commitValidatedProjectFilesEdit",
    );
  });
});
