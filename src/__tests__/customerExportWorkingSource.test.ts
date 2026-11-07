import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("customer account export includes saved working project files", () => {
  it("loads the latest saved working revision by default", () => {
    const source = readFileSync("src/lib/customerDataExport.ts", "utf8");
    expect(source).toContain("getProjectFiles: getEditableProjectFiles,");
    expect(source).toContain("Project ownership mismatch in customer export");
  });
});
