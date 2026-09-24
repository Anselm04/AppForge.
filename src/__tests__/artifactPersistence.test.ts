import { describe, expect, it } from "vitest";
import {
  MAX_ARTIFACT_FILE_BYTES,
  MAX_ARTIFACT_FILES,
  MAX_ARTIFACT_TOTAL_BYTES,
  assertArtifactIntegrity,
  buildArtifactIntegrity,
  validateArtifactFiles,
} from "../lib/artifactIntegrity.js";

describe("artifact persistence integrity", () => {
  it("builds deterministic per-file and aggregate SHA-256 metadata", () => {
    const files = {
      "src/App.tsx": "export function App(){ return <main>Real app</main>; }",
      "package.json": '{"name":"real-app","version":"1.0.0"}',
    };
    const a = buildArtifactIntegrity({
      projectId: 42,
      artifactVersion: 7,
      state: "final",
      files,
      now: "2026-09-24T00:00:00.000Z",
    });
    const b = buildArtifactIntegrity({
      projectId: 42,
      artifactVersion: 7,
      state: "final",
      files: {
        "package.json": files["package.json"],
        "src/App.tsx": files["src/App.tsx"],
      },
      now: "2026-09-24T00:00:00.000Z",
    });

    expect(a.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(a.sha256).toBe(b.sha256);
    expect(a.files).toEqual(b.files);
    expect(a.fileCount).toBe(2);
    expect(a.totalBytes).toBeGreaterThan(0);
  });

  it("preserves unchanged file versions and increments changed files", () => {
    const firstFiles = {
      "src/App.tsx": "export const version = 1;",
      "src/stable.ts": "export const stable = true;",
    };
    const first = buildArtifactIntegrity({
      projectId: 21,
      artifactVersion: 1,
      state: "working",
      files: firstFiles,
    });
    const second = buildArtifactIntegrity({
      projectId: 21,
      artifactVersion: 2,
      state: "working",
      files: {
        "src/App.tsx": "export const version = 2;",
        "src/stable.ts": firstFiles["src/stable.ts"],
        "src/new.ts": "export const created = true;",
      },
      previousIntegrity: first,
    });

    const firstByPath = new Map(first.files.map((file) => [file.path, file]));
    const secondByPath = new Map(second.files.map((file) => [file.path, file]));
    expect(secondByPath.get("src/stable.ts")?.fileVersion).toBe(
      firstByPath.get("src/stable.ts")?.fileVersion,
    );
    expect(secondByPath.get("src/App.tsx")?.fileVersion).toBe(
      (firstByPath.get("src/App.tsx")?.fileVersion ?? 0) + 1,
    );
    expect(secondByPath.get("src/new.ts")?.fileVersion).toBe(1);
  });

  it("rejects integrity metadata bound to another project or artifact version", () => {
    const files = { "src/App.tsx": "export const App = true;" };
    const integrity = buildArtifactIntegrity({
      projectId: 1,
      artifactVersion: 3,
      state: "final",
      files,
    });

    expect(() =>
      assertArtifactIntegrity({
        files,
        integrity,
        projectId: 2,
        artifactVersion: 3,
        requiredState: "final",
      }),
    ).toThrow(/does not match project\/version/);

    expect(() =>
      assertArtifactIntegrity({
        files,
        integrity,
        projectId: 1,
        artifactVersion: 4,
        requiredState: "final",
      }),
    ).toThrow(/does not match project\/version/);
  });

  it("detects file tampering after persistence", () => {
    const files = { "src/App.tsx": "export const version = 1;" };
    const integrity = buildArtifactIntegrity({
      projectId: 5,
      artifactVersion: 2,
      state: "working",
      files,
    });

    expect(() =>
      assertArtifactIntegrity({
        files: { "src/App.tsx": "export const version = 2;" },
        integrity,
        projectId: 5,
        artifactVersion: 2,
        requiredState: "working",
      }),
    ).toThrow(/integrity verification failed/);
  });

  it("prevents working artifacts from masquerading as final snapshots", () => {
    const files = { "src/App.tsx": "export const App = true;" };
    const integrity = buildArtifactIntegrity({
      projectId: 8,
      artifactVersion: 4,
      state: "working",
      files,
    });

    expect(() =>
      assertArtifactIntegrity({
        files,
        integrity,
        projectId: 8,
        artifactVersion: 4,
        requiredState: "final",
      }),
    ).toThrow(/Artifact state mismatch/);
  });

  it("rejects traversal, absolute paths, and known AppForge source mixing", () => {
    for (const path of [
      "../escape.ts",
      "/etc/passwd",
      "C:/Windows/system.ini",
      "src\\escape.ts",
      "src/agents/pipeline.generated.ts",
      "src/services/build-worker.ts",
      "src/db.ts",
      "src/db/schema.ts",
      "src/routes/livePreview.ts",
      "src/routes/hostedApps.ts",
      "src/routers/projects.ts",
      "src/lib/artifactIntegrity.ts",
      "src/services/deployer.ts",
      "src/services/productionAutoDeploy.ts",
      "src/agents/selfHealing.ts",
      "src/_core/env.ts",
    ]) {
      expect(() => validateArtifactFiles({ [path]: "x" }), path).toThrow();
    }
  });

  it("enforces artifact file-count, per-file, and total-size limits", () => {
    const tooMany = Object.fromEntries(
      Array.from({ length: MAX_ARTIFACT_FILES + 1 }, (_, i) => [
        `src/file-${i}.ts`,
        "export {};",
      ]),
    );
    expect(() => validateArtifactFiles(tooMany)).toThrow(/file-count limit/);

    expect(() =>
      validateArtifactFiles({
        "src/huge.txt": "x".repeat(MAX_ARTIFACT_FILE_BYTES + 1),
      }),
    ).toThrow(/file exceeds size limit/);

    const fileSize = Math.floor(MAX_ARTIFACT_TOTAL_BYTES / 11);
    const tooLarge = Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [
        `data/file-${i}.txt`,
        "x".repeat(fileSize),
      ]),
    );
    expect(() => validateArtifactFiles(tooLarge)).toThrow(/total-size limit/);
  });
});


describe("artifact snapshot database invariants", () => {
  it("runtime schema enforces one current snapshot and unique versions per project", () => {
    const { readFileSync } = require("node:fs");
    const schema = readFileSync("src/db/ensureSchema.ts", "utf8");
    const migration = readFileSync(
      "drizzle/0002_artifact_persistence.sql",
      "utf8",
    );
    for (const source of [schema, migration]) {
      expect(source).toContain("snapshots_one_current_per_project");
      expect(source).toContain("snapshots_project_version_unique");
    }
  });
});
