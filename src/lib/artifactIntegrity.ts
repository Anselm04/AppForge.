import { createHash } from "node:crypto";
import { posix } from "node:path";

export const MAX_ARTIFACT_FILES = 1000;
export const MAX_ARTIFACT_TOTAL_BYTES = 10 * 1024 * 1024;
export const MAX_ARTIFACT_FILE_BYTES = 1024 * 1024;

export type ArtifactState = "working" | "final";

export type ArtifactFileIntegrity = {
  path: string;
  sha256: string;
  bytes: number;
  /**
   * Monotonic version for this path. Legacy persisted integrity rows may omit
   * this field; new writes always populate it.
   */
  fileVersion?: number;
};

export type ArtifactIntegrity = {
  version: 1;
  projectId: number;
  artifactVersion: number;
  state: ArtifactState;
  fileCount: number;
  totalBytes: number;
  sha256: string;
  files: ArtifactFileIntegrity[];
  createdAt: string;
};

const APPFORGE_SOURCE_PATHS = new Set([
  "src/agents/selfHealing.ts",
  "src/services/productionAutoDeploy.ts",
  "src/services/deployer.ts",
  "src/lib/artifactIntegrity.ts",
  "src/routers/projects.ts",
  "src/routes/hostedApps.ts",
  "src/routes/livePreview.ts",
  "src/db/schema.ts",
  "src/db.ts",
  "src/agents/pipeline.generated.ts",
  "src/services/build-worker.ts",
  "src/db/ensureSchema.ts",
  "scripts/assemble-pipeline.mjs",
  ".codex/coordination/project.yaml",
  ".sdlc/project.yaml",
]);

const APPFORGE_SOURCE_PREFIXES = [
  "src/_core/",
  "src/agents/.pipeline_parts/",
  ".codex/coordination/",
  ".sdlc/runs/",
];

function safeArtifactPath(path: string): string {
  if (!path || path.includes("\0") || path.includes("\\")) {
    throw new Error(`Invalid artifact path: ${path}`);
  }
  if (path.startsWith("/") || /^[A-Za-z]:\//.test(path)) {
    throw new Error(`Absolute artifact path rejected: ${path}`);
  }
  const normalized = posix.normalize(path);
  if (
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    normalized !== path.replace(/^\.\//, "")
  ) {
    throw new Error(`Artifact path escapes project root: ${path}`);
  }
  if (
    APPFORGE_SOURCE_PATHS.has(normalized) ||
    APPFORGE_SOURCE_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  ) {
    throw new Error(
      `AppForge source path cannot be persisted as generated artifact: ${normalized}`,
    );
  }
  return normalized;
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function fileSha(path: string, content: string): string {
  return createHash("sha256")
    .update(path)
    .update("\0")
    .update(content)
    .digest("hex");
}

export function validateArtifactFiles(
  input: Record<string, string>,
): Record<string, string> {
  const entries = Object.entries(input);
  if (entries.length === 0) {
    throw new Error("Artifact must contain at least one file");
  }
  if (entries.length > MAX_ARTIFACT_FILES) {
    throw new Error(
      `Artifact exceeds file-count limit: ${entries.length} > ${MAX_ARTIFACT_FILES}`,
    );
  }

  const out: Record<string, string> = {};
  let totalBytes = 0;
  for (const [rawPath, content] of entries) {
    if (typeof content !== "string") {
      throw new Error(`Artifact file must be text: ${rawPath}`);
    }
    const path = safeArtifactPath(rawPath);
    if (path in out) {
      throw new Error(`Duplicate artifact path after normalization: ${path}`);
    }
    const bytes = byteLength(content);
    if (bytes > MAX_ARTIFACT_FILE_BYTES) {
      throw new Error(
        `Artifact file exceeds size limit: ${path} (${bytes} > ${MAX_ARTIFACT_FILE_BYTES})`,
      );
    }
    totalBytes += bytes;
    if (totalBytes > MAX_ARTIFACT_TOTAL_BYTES) {
      throw new Error(
        `Artifact exceeds total-size limit: ${totalBytes} > ${MAX_ARTIFACT_TOTAL_BYTES}`,
      );
    }
    out[path] = content;
  }
  return out;
}

export function buildArtifactIntegrity(input: {
  projectId: number;
  artifactVersion: number;
  state: ArtifactState;
  files: Record<string, string>;
  previousIntegrity?: ArtifactIntegrity | null;
  now?: string;
}): ArtifactIntegrity {
  if (!Number.isInteger(input.projectId) || input.projectId <= 0) {
    throw new Error("Artifact projectId must be a positive integer");
  }
  if (!Number.isInteger(input.artifactVersion) || input.artifactVersion <= 0) {
    throw new Error("Artifact version must be a positive integer");
  }
  const files = validateArtifactFiles(input.files);
  const previousByPath = new Map(
    (input.previousIntegrity?.files ?? []).map((entry) => [entry.path, entry]),
  );
  const fileIntegrity = Object.keys(files)
    .sort()
    .map((path) => {
      const sha256 = fileSha(path, files[path]);
      const previous = previousByPath.get(path);
      const previousVersion =
        previous?.fileVersion ??
        (previous ? input.previousIntegrity?.artifactVersion ?? 0 : 0);
      const fileVersion =
        previous && previous.sha256 === sha256
          ? Math.max(1, previousVersion)
          : Math.max(1, previousVersion + 1);
      return {
        path,
        sha256,
        bytes: byteLength(files[path]),
        fileVersion,
      };
    });
  const sha256 = createHash("sha256")
    .update(
      fileIntegrity
        .map(
          (entry) =>
            `${entry.path}\0${entry.sha256}\0${entry.bytes}\0${entry.fileVersion}\0`,
        )
        .join(""),
    )
    .digest("hex");

  return {
    version: 1,
    projectId: input.projectId,
    artifactVersion: input.artifactVersion,
    state: input.state,
    fileCount: fileIntegrity.length,
    totalBytes: fileIntegrity.reduce((sum, file) => sum + file.bytes, 0),
    sha256,
    files: fileIntegrity,
    createdAt: input.now ?? new Date().toISOString(),
  };
}

export function assertArtifactIntegrity(input: {
  files: Record<string, string>;
  integrity: unknown;
  projectId: number;
  artifactVersion: number;
  requiredState?: ArtifactState;
}): ArtifactIntegrity {
  if (!input.integrity || typeof input.integrity !== "object") {
    throw new Error("Artifact integrity metadata is missing");
  }
  const integrity = input.integrity as ArtifactIntegrity;
  if (
    integrity.version !== 1 ||
    integrity.projectId !== input.projectId ||
    integrity.artifactVersion !== input.artifactVersion
  ) {
    throw new Error("Artifact integrity metadata does not match project/version");
  }
  if (input.requiredState && integrity.state !== input.requiredState) {
    throw new Error(
      `Artifact state mismatch: expected ${input.requiredState}, got ${integrity.state}`,
    );
  }

  const files = validateArtifactFiles(input.files);
  const expectedPaths = Object.keys(files).sort();
  const persistedFiles = [...(integrity.files ?? [])].sort((a, b) =>
    a.path.localeCompare(b.path),
  );
  if (
    integrity.fileCount !== expectedPaths.length ||
    persistedFiles.length !== expectedPaths.length
  ) {
    throw new Error("Artifact integrity verification failed");
  }

  for (let index = 0; index < expectedPaths.length; index += 1) {
    const path = expectedPaths[index];
    const persisted = persistedFiles[index];
    if (
      !persisted ||
      persisted.path !== path ||
      persisted.sha256 !== fileSha(path, files[path]) ||
      persisted.bytes !== byteLength(files[path])
    ) {
      throw new Error("Artifact integrity verification failed");
    }
    if (
      persisted.fileVersion !== undefined &&
      (!Number.isInteger(persisted.fileVersion) || persisted.fileVersion <= 0)
    ) {
      throw new Error("Artifact file version metadata is invalid");
    }
  }

  const totalBytes = persistedFiles.reduce((sum, file) => sum + file.bytes, 0);
  if (integrity.totalBytes !== totalBytes) {
    throw new Error("Artifact integrity verification failed");
  }

  const versioned = persistedFiles.every(
    (file) => typeof file.fileVersion === "number",
  );
  const aggregate = createHash("sha256")
    .update(
      persistedFiles
        .map((entry) =>
          versioned
            ? `${entry.path}\0${entry.sha256}\0${entry.bytes}\0${entry.fileVersion}\0`
            : `${entry.path}\0${entry.sha256}\0${entry.bytes}\0`,
        )
        .join(""),
    )
    .digest("hex");
  if (aggregate !== integrity.sha256) {
    throw new Error("Artifact integrity verification failed");
  }
  return integrity;
}
