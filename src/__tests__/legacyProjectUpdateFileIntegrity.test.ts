import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("legacy project updateFile path cannot bypass versioned edits", () => {
  it("uses ownership and conflict-safe working snapshots", () => {
    const source = readFileSync("src/routers/projects.ts", "utf8");
    const start = source.indexOf("  updateFile: protectedProcedure");
    const end = source.indexOf("  validateFile: protectedProcedure", start);
    const route = source.slice(start, end);
    expect(route).toContain("commitValidatedProjectFileEdit({");
    expect(route).toContain("userId: ctx.user.id");
    expect(route).toContain("allowCreate: true");
    expect(route).not.toContain("updateProjectFiles(input.id");
  });
});
