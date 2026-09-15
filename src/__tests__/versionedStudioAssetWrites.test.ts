import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("versioned Studio asset writes", () => {
  it("routes Studio asset writes through the transactional snapshot service", () => {
    const source = readFileSync("src/routers/capabilities.ts", "utf8");
    expect(source).toContain("commitValidatedProjectFileEdit");
    expect(source).toContain("allowCreate: true");
    expect(source).toContain("skipValidation: true");
    expect(source).toContain("Studio asset:");
    expect(source).not.toContain(
      "await updateProjectFiles(input.projectId, files)",
    );
  });

  it("keeps normal source edits strict while allowing generated asset creation", () => {
    const source = readFileSync("src/services/projectFileEdits.ts", "utf8");
    expect(source).toContain("allowCreate?: boolean");
    expect(source).toContain("skipValidation?: boolean");
    expect(source).toContain("!input.allowCreate");
    expect(source).toContain("Validation skipped for generated asset");
  });
});
