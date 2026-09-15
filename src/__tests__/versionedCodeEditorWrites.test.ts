import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("versioned Code editor writes", () => {
  it("routes Code editor saves through the versioned write API", () => {
    const source = readFileSync("src/components/ProjectCodeEditor.tsx", "utf8");
    expect(source).toContain("trpc.versionedWrites.updateFile.mutate");
    expect(source).not.toContain("trpc.projects.updateFile.mutate");
  });

  it("uses the transactional project file edit service", () => {
    const source = readFileSync("src/routers/versionedWrites.ts", "utf8");
    expect(source).toContain("commitValidatedProjectFileEdit");
    expect(source).toContain("Manual edit:");
    expect(source).not.toContain("updateProjectFiles");
  });

  it("registers the versioned write router in the application API", () => {
    const source = readFileSync("src/routers/index.ts", "utf8");
    expect(source).toContain("versionedWritesRouter");
    expect(source).toContain("versionedWrites: versionedWritesRouter");
  });
});
