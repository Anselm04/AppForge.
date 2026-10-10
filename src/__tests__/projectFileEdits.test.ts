import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertArtifactIntegrity,
  buildArtifactIntegrity,
} from "../lib/artifactIntegrity.js";

const mocks = vi.hoisted(() => ({
  editable: vi.fn(),
  finalFiles: vi.fn(),
  transaction: vi.fn(),
  invalidate: vi.fn(),
}));
vi.mock("../db.js", () => ({
  getEditableProjectFiles: mocks.editable,
  getProjectFiles: mocks.finalFiles,
  db: { transaction: mocks.transaction },
}));
vi.mock("../lib/validateSingleFile.js", () => ({
  validateSingleFile: async () => ({ ok: true, message: "File check passed" }),
}));
vi.mock("../routes/livePreview.js", () => ({
  invalidatePreviewCache: mocks.invalidate,
}));
import {
  commitValidatedProjectFileEdit,
  type EditableProject,
} from "../services/projectFileEdits.js";
import * as schema from "../db/schema.js";

describe("working file edits", () => {
  const files = {
    "README.md": "Original",
    "src/App.tsx": "export const App = 1;",
  };
  let project: EditableProject;
  let snapshots: Record<string, unknown>[];
  let updates: Record<string, unknown>[];
  beforeEach(() => {
    snapshots = [];
    updates = [];
    project = {
      id: 68,
      userId: 1,
      techStack: "react-node",
      status: "paused",
      buildStage: "repairing",
      generatedFiles: { ...files },
      workingArtifactVersion: 4,
      workingArtifactIntegrity: buildArtifactIntegrity({
        projectId: 68,
        artifactVersion: 4,
        state: "working",
        files,
      }),
    } as EditableProject;
    mocks.editable.mockResolvedValue({ ...files });
    mocks.finalFiles.mockResolvedValue({});
    const tx = {
      execute: vi.fn(),
      select: (fields?: unknown) => ({
        from: () => ({
          where: () => ({
            limit: async () => [project],
            then: (resolve: (value: unknown) => void) =>
              resolve(fields ? [{ maxVersion: 0 }] : [project]),
          }),
        }),
      }),
      insert: () => ({
        values: (value: Record<string, unknown>) => {
          snapshots.push(value);
          return { returning: async () => [{ id: 99 }] };
        },
      }),
      update: (table: unknown) => ({
        set: (value: Record<string, unknown>) => ({
          where: async () => {
            updates.push(value);
            if (table === schema.projects) Object.assign(project, value);
          },
        }),
      }),
    };
    mocks.transaction.mockImplementation(async (fn) => fn(tx));
  });

  it("saves a displayed working file before any final snapshot exists and retains its integrity", async () => {
    await commitValidatedProjectFileEdit({
      project,
      userId: 1,
      path: "README.md",
      content: "Saved marker",
      label: "Manual edit",
    });
    expect(project.generatedFiles).toEqual({
      ...files,
      "README.md": "Saved marker",
    });
    expect(() =>
      assertArtifactIntegrity({
        files: project.generatedFiles as Record<string, string>,
        integrity: project.workingArtifactIntegrity!,
        projectId: 68,
        artifactVersion: project.workingArtifactVersion,
        requiredState: "working",
      }),
    ).not.toThrow();
    expect(project.workingArtifactVersion).toBe(5);
    expect(project.status).toBe("paused");
    expect(project.buildStage).toBe("repairing");
    expect(snapshots[0].isCurrent).toBe(false);
    expect(updates).not.toContainEqual({ isCurrent: false });
    expect(mocks.invalidate).toHaveBeenCalledWith(68);
  });

  it("does not publish a source edit as a validated final snapshot", async () => {
    mocks.finalFiles.mockResolvedValue({ ...files });
    await commitValidatedProjectFileEdit({
      project,
      userId: 1,
      path: "README.md",
      content: "Edit",
      label: "Manual edit",
    });
    expect(project.status).toBe("paused");
    expect(snapshots[0].isCurrent).toBe(false);
    expect(snapshots[0].artifactIntegrity).toMatchObject({ state: "working" });
  });

  it.each(["owner", "running", "tampered", "concurrent"])(
    "rejects %s changes without persisting a revision",
    async (reason) => {
      let expected = "Project not found";
      if (reason === "owner") project.userId = 2;
      if (reason === "running") {
        project.status = "running";
        expected = "Pause the build";
      }
      if (reason === "tampered" || reason === "concurrent") {
        project.generatedFiles = { ...files, "README.md": "Another edit" };
        expected = "Artifact integrity verification failed";
        if (reason === "concurrent") {
          project.workingArtifactIntegrity = buildArtifactIntegrity({
            projectId: 68,
            artifactVersion: 4,
            state: "working",
            files: project.generatedFiles as Record<string, string>,
          });
          expected = "Saved files changed";
        }
      }
      await expect(
        commitValidatedProjectFileEdit({
          project,
          userId: 1,
          path: "README.md",
          content: "Edit",
          label: "Manual edit",
        }),
      ).rejects.toThrow(expected);
      expect(snapshots).toEqual([]);
      expect(updates).toEqual([]);
    },
  );
});
