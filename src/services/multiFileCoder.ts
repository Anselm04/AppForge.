/**
 * Parse multi-file LLM coder output and ensure essential project files exist.
 */
import {
  getStackScaffold,
  mergeScaffoldWithGenerated,
} from "./stackScaffolds.js";

const FILENAME_RE = /^\/\/\s*filename:\s*(.+)$/gm;

/** Split an LLM response that may contain multiple `// filename:` blocks. */
export function parseGeneratedFiles(llmOutput: string): Record<string, string> {
  const files: Record<string, string> = {};
  if (!llmOutput || typeof llmOutput !== "string") return files;

  const matches = [...llmOutput.matchAll(FILENAME_RE)];
  if (matches.length === 0) return files;

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const filename = match[1].trim().replace(/^['"]|['"]$/g, "");
    if (!filename || filename.includes("..")) continue;
    const start = (match.index ?? 0) + match[0].length;
    const end =
      i + 1 < matches.length
        ? (matches[i + 1].index ?? llmOutput.length)
        : llmOutput.length;
    let content = llmOutput.slice(start, end).replace(/^\n/, "");
    content = content.replace(/\n```\s*$/, "").replace(/^```[a-z]*\n/, "");
    files[filename] = `// filename: ${filename}\n${content.trimStart()}`;
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

  if (needsPkg || !out["README.md"]) {
    return mergeScaffoldWithGenerated(getStackScaffold(techStack), out);
  }
  return out;
}

export default { parseGeneratedFiles, ensureEssentialFiles };
