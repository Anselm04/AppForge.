/**
 * Parse multi-file LLM coder output and ensure essential project files exist.
 */
import {
  getStackScaffold,
  mergeScaffoldWithGenerated,
} from "./stackScaffolds.js";
import { stripFilenameHeaders } from "../lib/reliableBuild.js";

const FILENAME_RE = /^\/\/\s*filename:\s*(.+)$/gm;

/** Split an LLM response that may contain multiple `// filename:` blocks. */
export function parseGeneratedFiles(llmOutput: string): Record<string, string> {
  const files: Record<string, string> = {};
  if (!llmOutput || typeof llmOutput !== "string") return files;

  const matches = [...llmOutput.matchAll(FILENAME_RE)];
  if (matches.length === 0) {
    // Single-file fallback: // filename: at top
    const single = llmOutput.match(/^\/\/\s*filename:\s*(.+)\r?\n([\s\S]*)$/m);
    if (single) {
      const filename = single[1].trim().replace(/^['"]|['"]$/g, "");
      if (filename && !filename.includes("..")) {
        files[filename] = stripFilenameHeaders(single[2]);
      }
    }
    return files;
  }

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const filename = match[1].trim().replace(/^['"]|['"]$/g, "");
    if (!filename || filename.includes("..")) continue;
    const start = (match.index ?? 0) + match[0].length;
    const end =
      i + 1 < matches.length
        ? (matches[i + 1].index ?? llmOutput.length)
        : llmOutput.length;
    const content = stripFilenameHeaders(llmOutput.slice(start, end));
    if (content.trim().length > 0) {
      files[filename] = content;
    }
  }
  return files;
}

/** Ensure package.json / README exist by merging a scaffold if needed. */
export function ensureEssentialFiles(
  files: Record<string, string>,
  techStack: string,
): Record<string, string> {
  const out = { ...files };
  const needsPkg =
    !out["package.json"] &&
    !out["requirements.txt"] &&
    !out["pyproject.toml"] &&
    !out["Cargo.toml"] &&
    !out["pubspec.yaml"];

  if (needsPkg || !out["README.md"] || !out["index.html"]) {
    return mergeScaffoldWithGenerated(getStackScaffold(techStack), out);
  }
  return out;
}

export default { parseGeneratedFiles, ensureEssentialFiles };
