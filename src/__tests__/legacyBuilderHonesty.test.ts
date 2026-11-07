import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("only real project workflows can claim customer delivery", () => {
  it("does not ship the abandoned legacy AppBuilder stub", () => {
    expect(
      existsSync(resolve(process.cwd(), "src/services/app-builder.ts")),
    ).toBe(false);
  });

  it("retains the persisted editing and validated product paths", () => {
    const edits = readFileSync(
      resolve(process.cwd(), "src/services/projectFileEdits.ts"),
      "utf8",
    );
    const projects = readFileSync(
      resolve(process.cwd(), "src/routers/projects.ts"),
      "utf8",
    );
    expect(edits).toContain("projectId");
    expect(edits).toContain("working");
    expect(projects).toContain("validated");
    expect(projects).toContain("export");
  });
});
