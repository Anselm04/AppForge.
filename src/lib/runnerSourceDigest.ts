import { createHash } from "node:crypto";

/**
 * SHA-256 of canonical source content, independent of input key insertion order.
 * This is not a replacement for the project/version-specific artifact integrity.
 */
export function runnerSourceSha256(files: Record<string, string>): string {
  const paths = Object.keys(files).sort();
  const ordered = Object.fromEntries(paths.map((path) => [path, files[path]]));
  return createHash("sha256").update(JSON.stringify(ordered)).digest("hex");
}
