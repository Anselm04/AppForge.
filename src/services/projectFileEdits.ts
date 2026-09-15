import {
  commitProjectFilesSnapshot,
  getProjectFiles,
  type getProjectById,
} from "../db.js";
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
