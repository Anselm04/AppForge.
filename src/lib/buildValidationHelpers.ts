import {
  validateGeneratedBuild,
  type ValidationResult,
} from "../agents/buildValidator.js";
import { getValidationMode } from "./validationMode.js";

/** Score paths by relevance to an edit request (imports, routes, mentioned paths). */
export function selectFilesForEditContext(
  request: string,
  files: Record<string, string>,
  maxFiles = 16,
): string[] {
  const paths = Object.keys(files).sort();
  if (paths.length <= maxFiles) return paths;

  const req = request.toLowerCase();
  const mentioned = new Set<string>();
  for (const p of paths) {
    const base = p.split("/").pop()?.toLowerCase() ?? "";
    if (req.includes(p.toLowerCase()) || (base && req.includes(base))) {
      mentioned.add(p);
    }
  }

  const scored = paths.map((path) => {
    let score = 0;
    const lower = path.toLowerCase();
    if (mentioned.has(path)) score += 100;
    if (lower.includes("app.") || lower.endsWith("main.tsx")) score += 40;
    if (lower.includes("route") || lower.includes("page")) score += 30;
    if (lower.includes("index.")) score += 25;
    if (lower.startsWith("src/components/")) score += 15;
    if (lower.startsWith("src/")) score += 10;
    if (lower.endsWith(".test.")) score -= 20;
    if (lower.endsWith(".md")) score -= 30;
    return { path, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const picked = scored.slice(0, maxFiles).map((s) => s.path);
  for (const p of mentioned) {
    if (!picked.includes(p)) picked.unshift(p);
  }
  return picked.slice(0, maxFiles);
}

export function buildEditContextSample(
  request: string,
  files: Record<string, string>,
  maxFiles = 16,
  maxCharsPerFile = 4000,
): string[] {
  return selectFilesForEditContext(request, files, maxFiles).map((path) => {
    const content = files[path] ?? "";
    const preview =
      content.length > maxCharsPerFile
        ? `${content.slice(0, maxCharsPerFile)}\n…`
        : content;
    return `--- ${path} ---\n${preview}`;
  });
}

/** Run sandbox validation on project files after edits. */
export async function validateProjectFiles(
  files: Record<string, string>,
  techStack: string | null | undefined,
  options?: { testsBlocking?: boolean },
): Promise<ValidationResult> {
  const stack = techStack ?? "react-node";
  const mode = getValidationMode(stack);
  const testsBlocking = options?.testsBlocking ?? mode === "full";
  return validateGeneratedBuild(files, stack, { testsBlocking });
}
