import { eq, sql } from "drizzle-orm";
import { db, getEditableProjectFiles, type getProjectById } from "../db.js";
import * as schema from "../db/schema.js";
import {
  assertArtifactIntegrity,
  buildArtifactIntegrity,
  validateArtifactFiles,
} from "../lib/artifactIntegrity.js";
import { validateSingleFile } from "../lib/validateSingleFile.js";

export type EditableProject = NonNullable<
  Awaited<ReturnType<typeof getProjectById>>
>;

function safeProjectPath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/");
  return (
    normalized.length > 0 &&
    !normalized.startsWith("/") &&
    !normalized.split("/").some((segment) => segment === "..")
  );
}

async function commitProjectFilesSnapshot(input: {
  projectId: number;
  userId: number;
  label: string;
  files: Record<string, string>;
  originalFiles: Record<string, string>;
  techStack: string;
  validationResult?: unknown;
}) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${input.projectId})`);
    const rows = await tx
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, input.projectId))
      .limit(1);
    const project = rows[0];
    if (!project || project.userId !== input.userId) {
      throw new Error("Project not found");
    }
    if (project.status === "running") {
      throw new Error("Pause the build before editing saved files");
    }
    const workingFiles = project.generatedFiles
      ? validateArtifactFiles(project.generatedFiles as Record<string, string>)
      : {};
    const currentFiles =
      Object.keys(workingFiles).length > 0 ? workingFiles : input.originalFiles;
    if (
      project.workingArtifactIntegrity &&
      Object.keys(workingFiles).length > 0
    ) {
      assertArtifactIntegrity({
        files: currentFiles,
        integrity: project.workingArtifactIntegrity,
        projectId: input.projectId,
        artifactVersion: project.workingArtifactVersion,
        requiredState: "working",
      });
    }
    if (
      Object.keys(currentFiles).length !==
        Object.keys(input.originalFiles).length ||
      Object.entries(currentFiles).some(
        ([path, content]) => input.originalFiles[path] !== content,
      )
    ) {
      throw new Error(
        "Saved files changed during this edit. Reload them and try again.",
      );
    }
    const workingArtifactVersion = (project.workingArtifactVersion ?? 0) + 1;
    const workingArtifactIntegrity = buildArtifactIntegrity({
      projectId: input.projectId,
      artifactVersion: workingArtifactVersion,
      state: "working",
      files: input.files,
      previousIntegrity: project.workingArtifactIntegrity,
    });

    const versionResult = await tx
      .select({
        maxVersion: sql<number>`COALESCE(MAX(${schema.buildSnapshots.version}), 0)::int`,
      })
      .from(schema.buildSnapshots)
      .where(eq(schema.buildSnapshots.projectId, input.projectId));
    const version = Number(versionResult[0]?.maxVersion ?? 0) + 1;

    // An isolated file check cannot certify the complete product. Retain the
    // validated serving snapshot and save this revision as working source only.
    const snapshotIntegrity = buildArtifactIntegrity({
      projectId: input.projectId,
      artifactVersion: version,
      state: "working",
      files: input.files,
      previousIntegrity: project.workingArtifactIntegrity,
    });
    const inserted = await tx
      .insert(schema.buildSnapshots)
      .values({
        projectId: input.projectId,
        userId: input.userId,
        version,
        label: input.label.slice(0, 255),
        files: input.files,
        fileCount: Object.keys(input.files).length,
        techStack: input.techStack,
        validationResult: input.validationResult ?? null,
        artifactIntegrity: snapshotIntegrity,
        isCurrent: false,
      })
      .returning({ id: schema.buildSnapshots.id });

    await tx
      .update(schema.projects)
      .set({
        generatedFiles: input.files,
        workingArtifactVersion,
        workingArtifactIntegrity,
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, input.projectId));

    return { id: inserted[0].id, version };
  });
}

export async function commitValidatedProjectFileEdit(input: {
  project: EditableProject;
  userId: number;
  path: string;
  content: string;
  label: string;
  requireValid?: boolean;
  allowCreate?: boolean;
  skipValidation?: boolean;
}) {
  if (!safeProjectPath(input.path)) {
    throw new Error("Invalid project file path");
  }
  const files = await getEditableProjectFiles(input.project.id);
  if (!(input.path in files) && !input.allowCreate) {
    throw new Error("Project file not found");
  }

  const validation = input.skipValidation
    ? { ok: true, message: "Validation skipped for generated asset" }
    : await validateSingleFile(input.path, input.content, files);
  if (!validation.ok && input.requireValid) {
    throw new Error(validation.message || "File validation failed");
  }

  const nextFiles = { ...files, [input.path]: input.content };
  const snapshot = await commitProjectFilesSnapshot({
    projectId: input.project.id,
    userId: input.userId,
    label: input.label,
    files: nextFiles,
    originalFiles: files,
    techStack: input.project.techStack ?? "unknown",
    validationResult: validation,
  });

  const { invalidatePreviewCache } = await import("../routes/livePreview.js");
  invalidatePreviewCache(input.project.id);

  return {
    ok: true as const,
    path: input.path,
    snapshotId: snapshot.id,
    version: snapshot.version,
    validation,
  };
}
