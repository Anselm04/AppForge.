/**
 * Parse multi-file LLM coder output and ensure essential project files exist.
 */
import {
  getStackScaffold,
  mergeScaffoldWithGenerated,
} from "./stackScaffolds.js";
import { stripFilenameHeaders } from "../lib/reliableBuild.js";

/**
 * Source-order recovery adapted from Bolt.diy's streaming action boundaries.
 * Original: app/lib/runtime/message-parser.ts (MIT; third_party/bolt/LICENSE).
 * Modified for AppForge's legacy headers, fenced paths, and path validation.
 */
const HEADER_RE =
  /^(?:\/\/[ \t]*(?:filename|file):[ \t]*(.+)|#[ \t]*file:[ \t]*(.+)|###[ \t]*\x60?([\w./-]+\.[A-Za-z0-9]+)\x60?[ \t]*|File:[ \t]*[\x60"]?([\w./-]+\.[A-Za-z0-9]+)[\x60"]?[ \t]*)\r?$/gim;
const FENCED_PATH_RE =
  /^\x60{3}([a-zA-Z0-9]*)[ \t]+([\w./-]+\.[A-Za-z0-9]+)[ \t]*\r?\n([\s\S]*?)^\x60{3}[ \t]*$/gm;
const ANY_FENCE_RE = /^\x60{3}[^\r\n]*\r?\n[\s\S]*?^\x60{3}[ \t]*$/gm;

function cleanPath(raw: string): string | null {
  const filename = raw
    .trim()
    .replace(/^['"\x60]+|['"\x60]+$/g, "")
    .replace(/^\.\//, "");
  if (
    !filename ||
    filename.startsWith("/") ||
    filename.includes("\\") ||
    filename.includes(":") ||
    [...filename].some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    ) ||
    filename.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    return null;
  }
  return filename;
}

interface FileBoundary {
  index: number;
  end: number;
  path: string | null;
  fencedContent?: string;
}

/** Recover every supported file type in its original source order. */
export function parseGeneratedFiles(llmOutput: string): Record<string, string> {
  if (!llmOutput || typeof llmOutput !== "string") return {};

  // Filename-like comments inside fenced code are genuine source, not headers.
  const fences = [...llmOutput.matchAll(ANY_FENCE_RE)].map((match) => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
  const boundaries: FileBoundary[] = [];

  for (const match of llmOutput.matchAll(HEADER_RE)) {
    const index = match.index ?? 0;
    if (fences.some((fence) => index >= fence.start && index < fence.end))
      continue;
    boundaries.push({
      index,
      end: index + match[0].length,
      path: cleanPath(match[1] ?? match[2] ?? match[3] ?? match[4] ?? ""),
    });
  }

  for (const match of llmOutput.matchAll(FENCED_PATH_RE)) {
    const index = match.index ?? 0;
    boundaries.push({
      index,
      end: index + match[0].length,
      path: cleanPath(match[2] ?? ""),
      fencedContent: match[3] ?? "",
    });
  }

  boundaries.sort((a, b) => a.index - b.index);
  const files: Record<string, string> = {};
  for (let i = 0; i < boundaries.length; i++) {
    const boundary = boundaries[i];
    // Even rejected headers delimit earlier content: never append unsafe
    // file bodies to another customer's generated artifact.
    if (!boundary.path) continue;
    const next = boundaries[i + 1]?.index ?? llmOutput.length;
    const content =
      boundary.fencedContent ??
      stripFilenameHeaders(llmOutput.slice(boundary.end, next), boundary.path);
    if (content.trim()) files[boundary.path] = content;
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
