import { eq, sql } from "drizzle-orm";
import { db, getProjectFiles, type getProjectById } from "../db.js";
import * as schema from "../db/schema.js";
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
  techStack: string;
  validationResult?: unknown;
}) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT id FROM ${schema.projects} WHERE id = ${input.projectId} FOR UPDATE`,
    );

    const versionResult = await tx
      .select({
        maxVersion: sql<number>`COALESCE(MAX(${schema.buildSnapshots.version}), 0)::int`,
      })
      .from(schema.buildSnapshots)
      .where(eq(schema.buildSnapshots.projectId, input.projectId));
    const version = Number(versionResult[0]?.maxVersion ?? 0) + 1;

    await tx
      .update(schema.buildSnapshots)
      .set({ isCurrent: false })
      .where(eq(schema.buildSnapshots.projectId, input.projectId));

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
        isCurrent: true,
      })
      .returning({ id: schema.buildSnapshots.id });

    await tx
      .update(schema.projects)
      .set({
        generatedFiles: input.files,
        status: "completed",
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
}) {
  if (!safeProjectPath(input.path)) {
    throw new Error("Invalid project file path");
  }
  const files = await getProjectFiles(input.project.id);
  if (!(input.path in files)) {
    throw new Error("Project file not found");
  }

  const validation = await validateSingleFile(input.path, input.content, files);
  if (!validation.ok && input.requireValid) {
    throw new Error(validation.message || "File validation failed");
  }

  const nextFiles = { ...files, [input.path]: input.content };
  const snapshot = await commitProjectFilesSnapshot({
    projectId: input.project.id,
    userId: input.userId,
    label: input.label,
    files: nextFiles,
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
