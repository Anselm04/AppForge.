import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("template factory retains project working revisions", () => {
  it("adds the template manifest through versioned working-file storage", () => {
    const source = readFileSync("src/routers/templateFactory.ts", "utf8");
    expect(source).toContain("commitValidatedProjectFileEdit({");
    expect(source).toContain("path: manifestPath");
    expect(source).toContain("allowCreate: true");
    expect(source).not.toContain(
      "[manifestPath]: JSON.stringify(manifest, null, 2)",
    );
    expect(source).toContain("getProjectFiles(input.sourceProjectId)");
  });
});
