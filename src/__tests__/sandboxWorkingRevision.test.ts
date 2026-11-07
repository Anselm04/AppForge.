import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("customer sandbox file synchronization", () => {
  it("synchronizes the latest working files instead of a stale validated snapshot", () => {
    const source = readFileSync("src/services/projectSandbox.ts", "utf8");
    expect(source).toContain("getEditableProjectFiles(session.projectId)");
    expect(source).not.toContain("getProjectFiles(session.projectId)");
    expect(source).toContain("assertLocalSandboxAllowed()");
  });
});
