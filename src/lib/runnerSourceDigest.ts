import { createHash } from "node:crypto";

/**
 * Stable source-content digest used across isolated native build proofs and
 * snapshots. ArtifactIntegrity retains its separate project/version-specific
 * SHA-256 identity; this digest establishes that the exact file contents
 * sent to a runner match the files later persisted.
 */
export function runnerSourceSha256(files: Record<string, string>): string {
  const ordered = Object.fromEntries(
    Object.entries(files).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    ),
  );
  return createHash("sha256")
    .update(JSON.stringify(ordered))
    .digest("hex");
}
