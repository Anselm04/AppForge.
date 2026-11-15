/**
 * Parse multi-file LLM coder output and ensure essential project files exist.
 */
import {
  getStackScaffold,
  mergeScaffoldWithGenerated,
} from "./stackScaffolds.js";
import { stripFilenameHeaders } from "../lib/reliableBuild.js";
import { getStackAdapter } from "../lib/stackAdapters.js";

/**
 * Source-order recovery adapted from Bolt.diy's streaming action boundaries.
 * Original: app/lib/runtime/message-parser.ts (MIT; third_party/bolt/LICENSE).
 * Modified for AppForge's legacy headers, fenced paths, and path validation.
 */
const HEADER_RE =
  /^(?:\/\/[ \t]*(?:filename|file):[ \t]*(.+)|#[ \t]*file:[ \t]*(.+)|###[ \t]*\x60?([\w./-]+\.[A-Za-z0-9]+)\x60?[ \t]*|File:[ \t]*[\x60"]?([\w./-]+\.[A-Za-z0-9]+)[\x60"]?[ \t]*)\r?$/gim;
const FENCED_PATH_RE =
  /^\x60{3}([a-zA-Z0-9]*)[ \t]+([\w./-]+\.[A-Za-z0-9]+)[ \t]*\r?\n([\s\S]*?)^\x60{3}[ \t]*\r?$/gm;
const ANY_FENCE_RE = /^\x60{3}[^\r\n]*\r?\n[\s\S]*?^\x60{3}[ \t]*\r?$/gm;
/**
 * Bolt.diy's artifact protocol emits <boltAction type="file" filePath="...">
 * boundaries rather than filename comments. Recover only complete actions;
 * shell actions are delimiters, never executable customer source.
 * Source: app/lib/runtime/message-parser.ts (MIT; third_party/bolt/LICENSE).
 */
const BOLT_ACTION_RE = /<boltAction\b([^>]*?)>([\s\S]*?)<\/boltAction\s*>/gi;

function boltAttribute(attrs: string, name: string): string | null {
  const matched = attrs.match(new RegExp("\\b" + name + "\\s*=\\s*([\\\"'])(.*?)\\1", "i"));
  return matched?.[2] ?? null;
}

function boltFileContent(value: string): string {
  const fenced = value.match(/^\s*`{3}[^\r\n]*\r?\n([\s\S]*?)\r?\n\s*`{3}\s*$/);
  const source = fenced ? fenced[1] : value;
  return source.replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

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
  const boltActions = [...llmOutput.matchAll(BOLT_ACTION_RE)];
  const actionRanges = boltActions.map((match) => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));

  for (const match of boltActions) {
    const index = match.index ?? 0;
    const isFile = boltAttribute(match[1] ?? "", "type") === "file";
    boundaries.push({
      index,
      end: index + match[0].length,
      path: isFile
        ? cleanPath(boltAttribute(match[1] ?? "", "filePath") ?? "")
        : null,
      fencedContent: isFile ? boltFileContent(match[2] ?? "") : undefined,
    });
  }

  for (const match of llmOutput.matchAll(HEADER_RE)) {
    const index = match.index ?? 0;
    if (
      fences.some((fence) => index >= fence.start && index < fence.end) ||
      actionRanges.some((action) => index >= action.start && index < action.end)
    )
      continue;
    boundaries.push({
      index,
      end: index + match[0].length,
      path: cleanPath(match[1] ?? match[2] ?? match[3] ?? match[4] ?? ""),
    });
  }

  for (const match of llmOutput.matchAll(FENCED_PATH_RE)) {
    const index = match.index ?? 0;
    if (
      actionRanges.some((action) => index >= action.start && index < action.end)
    )
      continue;
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
  // A manifest for another language is not evidence the selected stack has
  // its required build manifest (e.g. requirements.txt is not package.json).
  const adapter = getStackAdapter(techStack);
  const needsManifest =
    !out[adapter.dependencyManifest] ||
    (adapter.id === "flutter-node" && !out["package.json"]);

  if (needsManifest || !out["README.md"] || !out["index.html"]) {
    return mergeScaffoldWithGenerated(getStackScaffold(techStack), out);
  }
  return out;
}

export default { parseGeneratedFiles, ensureEssentialFiles };
