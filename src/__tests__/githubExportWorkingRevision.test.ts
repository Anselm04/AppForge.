import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GitHub source export preserves saved customer work", () => {
  it("pushes current editable files and refuses credentials", () => {
    const source = readFileSync("src/routers/github.ts", "utf8");
    const start = source.indexOf("  pushToRepo: protectedProcedure");
    const end = source.indexOf("  importFromRepo: protectedProcedure", start);
    const route = source.slice(start, end);
    expect(route).toContain("getEditableProjectFiles(input.projectId)");
    expect(route).not.toContain("getProjectFiles(input.projectId)");
    expect(route).toContain("!isSafeTemplatePath(path)");
    expect(route).toContain("!isSafeTemplateContent(content)");
  });
});
