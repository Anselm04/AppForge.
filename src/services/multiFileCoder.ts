/**
 * Parse multi-file LLM coder output and ensure essential project files exist.
 */
import {
  getStackScaffold,
  mergeScaffoldWithGenerated,
} from "./stackScaffolds.js";
import { stripFilenameHeaders } from "../lib/reliableBuild.js";

/** Primary marker used by AppForge coder prompts. */
const FILENAME_RE = /^\/\/\s*filename:\s*(.+)$/gim;
/** Common alternate markers models emit. */
const ALT_MARKERS: RegExp[] = [
  /^\/\/\s*file:\s*(.+)$/gim,
  /^#\s*file:\s*(.+)$/gim,
  /^###\s*`?([\w./-]+\.(?:tsx?|jsx?|css|json|html|md|mjs|cjs))`?\s*$/gim,
  /^File:\s*[`"]?([\w./-]+\.(?:tsx?|jsx?|css|json|html|md|mjs|cjs))[`"]?\s*$/gim,
];

function cleanPath(raw: string): string | null {
  const filename = raw
    .trim()
    .replace(/^['"`]+|['"`]+$/g, "")
    .replace(/^\.\//, "");
  if (!filename || filename.includes("..") || filename.startsWith("/")) {
    return null;
  }
  return filename;
}

function parseWithRegex(
  llmOutput: string,
  re: RegExp,
): Record<string, string> {
  const files: Record<string, string> = {};
  const matches = [...llmOutput.matchAll(re)];
  if (matches.length === 0) return files;

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const filename = cleanPath(match[1] ?? "");
    if (!filename) continue;
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

/**
 * Recover files from fenced blocks labeled like:
 * ```tsx src/App.tsx
 * ...
 * ```
 */
function parseFencedPathBlocks(llmOutput: string): Record<string, string> {
  const files: Record<string, string> = {};
  const re =
    /```([a-zA-Z0-9]*)\s+([\w./-]+\.(?:tsx?|jsx?|css|json|html|md|mjs|cjs))\s*\n([\s\S]*?)```/g;
  for (const match of llmOutput.matchAll(re)) {
    const filename = cleanPath(match[2] ?? "");
    if (!filename) continue;
    const content = stripFilenameHeaders(match[3] ?? "");
    if (content.trim().length > 0) files[filename] = content;
  }
  return files;
}

/** Split an LLM response that may contain multiple file blocks. */
export function parseGeneratedFiles(llmOutput: string): Record<string, string> {
  if (!llmOutput || typeof llmOutput !== "string") return {};

  // Prefer explicit // filename: markers
  let files = parseWithRegex(llmOutput, FILENAME_RE);
  if (Object.keys(files).length > 0) return files;

  for (const re of ALT_MARKERS) {
    files = parseWithRegex(llmOutput, re);
    if (Object.keys(files).length > 0) return files;
  }

  files = parseFencedPathBlocks(llmOutput);
  if (Object.keys(files).length > 0) return files;

  // Single-file fallback: // filename: at top
  const single = llmOutput.match(/^\/\/\s*filename:\s*(.+)\r?\n([\s\S]*)$/m);
  if (single) {
    const filename = cleanPath(single[1]);
    if (filename) {
      files[filename] = stripFilenameHeaders(single[2]);
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
