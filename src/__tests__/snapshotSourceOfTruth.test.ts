import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("snapshot source-of-truth integrity", () => {
  it("activates only a validated final snapshot without copying it into working files", () => {
    const source = readFileSync("src/db.ts", "utf8");
    expect(source).toContain("Snapshot not found for project");
    expect(source).toContain('requiredState: "final"');
    expect(source).toContain(".set({ isCurrent: false })");
    expect(source).toContain(".set({ isCurrent: true })");
    expect(source).not.toContain("generatedFiles: snapshot.files");
    expect(source).toContain("invalidatePreviewCache(projectId)");
  });

  it("keeps working artifacts separate from preview/deployment source-of-truth", () => {
    const dbSource = readFileSync("src/db.ts", "utf8");
    const previewSource = readFileSync("src/routes/livePreview.ts", "utf8");
    const projectRouter = readFileSync("src/routers/projects.ts", "utf8");
    const hostedSource = readFileSync("src/routes/hostedApps.ts", "utf8");
    const workerSource = readFileSync("src/services/build-worker.ts", "utf8");

    expect(dbSource).toContain("getCurrentArtifact(projectId)");
    expect(previewSource).toContain("await getCurrentArtifact(projectId)");
    expect(hostedSource).toContain("await getCurrentArtifact(projectId)");
    expect(workerSource).toContain("await getCurrentArtifact(projectId)");
    expect(projectRouter).toContain("await getCurrentArtifact(input.id)");
    expect(projectRouter).not.toContain(
      "(project.generatedFiles as Record<string, string> | null)",
    );
  });

  it("routes rollback through the atomic snapshot activation path without copying into working files", () => {
    const source = readFileSync("src/routers/projects.ts", "utf8");
    const rollbackStart = source.indexOf("rollback: protectedProcedure");
    const rollbackEnd = source.indexOf(
      "getFiles: protectedProcedure",
      rollbackStart,
    );
    const rollback = source.slice(rollbackStart, rollbackEnd);
    expect(rollback).toContain(
      "await markSnapshotAsCurrent(input.snapshotId, input.projectId)",
    );
    expect(rollback).not.toContain("updateProjectFiles");
  });

  it("versions completed artifact additions as new current snapshots", () => {
    const dbSource = readFileSync("src/db.ts", "utf8");
    const engineSource = readFileSync("src/services/artifactEngine.ts", "utf8");
    expect(dbSource).toContain("appendArtifactToCurrentSnapshot");
    expect(dbSource).toContain("artifact update");
    expect(engineSource).toContain("appendArtifactToCurrentSnapshot(input)");
    expect(engineSource).not.toContain("updateProjectFiles");
  });
});
