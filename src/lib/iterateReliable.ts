/**
 * Priority 2 — iterate without losing Item-1 green builds.
 * Apply chat patches, harden, validate, fix, or roll back.
 */

import {
  appliesGoldenWebLimits,
  hardenGeneratedProject,
} from "./reliableBuild.js";
import { requireExplicitStack } from "./stackDefaults.js";
import { stripComplianceFromGolden, capGoldenFiles } from "./goldenLimits.js";
import { applyDeterministicErrorFixes } from "./errorFixTable.js";
import { mergeSurgicalPatches } from "./surgicalFix.js";
import type { ValidationResult } from "../agents/buildValidator.js";

export type IteratePatch = {
  path: string;
  action: "create" | "modify" | "delete";
  content?: string;
};

export function applyPatches(
  files: Record<string, string>,
  patches: IteratePatch[],
): Record<string, string> {
  const next = { ...files };
  for (const patch of patches) {
    const safePath = (patch.path || "")
      .replace(/^\/+/, "")
      .replace(/\.\./g, "");
    if (!safePath || safePath.includes("..")) continue;
    if (patch.action === "delete") {
      delete next[safePath];
    } else if (typeof patch.content === "string") {
      next[safePath] = patch.content;
    }
  }
  return next;
}

/**
 * Post-edit harden with the same stack adapter as generation. Runnable web
 * bundler stacks keep the golden file cap; every other stack (mobile, desktop
 * shells, services, Python, extensions) is hardened without trimming or
 * converting it.
 */
export function hardenAfterIterate(
  files: Record<string, string>,
  techStack: string,
): Record<string, string> {
  const stack = requireExplicitStack(techStack);
  let out = { ...files };
  if (appliesGoldenWebLimits(stack)) {
    out = stripComplianceFromGolden(out);
    out = capGoldenFiles(out, 14);
  }
  out = hardenGeneratedProject(out, stack);
  return out;
}

export type IterateOutcome = {
  files: Record<string, string>;
  rolledBack: boolean;
  fixed: boolean;
  validation: ValidationResult | null;
  notes: string[];
};

/**
 * Ensure iterated files stay green. Caller provides validate + optional surgical LLM fix.
 */
export async function ensureIterateGreen(opts: {
  baseline: Record<string, string>;
  candidate: Record<string, string>;
  techStack: string;
  validate: (files: Record<string, string>) => Promise<ValidationResult>;
  surgicalFix?: (
    files: Record<string, string>,
    errors: string[],
  ) => Promise<Record<string, string>>;
  maxFixAttempts?: number;
}): Promise<IterateOutcome> {
  const notes: string[] = [];
  const techStack = requireExplicitStack(opts.techStack);
  let files = hardenAfterIterate(opts.candidate, techStack);
  let validation = await opts.validate(files);

  if (validation.passed) {
    return { files, rolledBack: false, fixed: false, validation, notes };
  }

  const max = opts.maxFixAttempts ?? 2;
  for (let attempt = 1; attempt <= max; attempt++) {
    const det = applyDeterministicErrorFixes(files, validation.errors ?? []);
    if (det.applied.length > 0) {
      files = hardenAfterIterate(det.files, techStack);
      notes.push(`deterministic:${det.applied.join(",")}`);
      validation = await opts.validate(files);
      if (validation.passed) {
        return { files, rolledBack: false, fixed: true, validation, notes };
      }
    }

    if (opts.surgicalFix) {
      try {
        const patched = await opts.surgicalFix(files, validation.errors ?? []);
        files = hardenAfterIterate(
          mergeSurgicalPatches(files, patched),
          techStack,
        );
        notes.push(`surgical:${attempt}`);
        validation = await opts.validate(files);
        if (validation.passed) {
          return { files, rolledBack: false, fixed: true, validation, notes };
        }
      } catch {
        notes.push(`surgical-failed:${attempt}`);
      }
    }
  }

  // Rollback — never leave a red tree after chat edit
  const rolled = hardenAfterIterate(opts.baseline, techStack);
  notes.push("rollback");
  return {
    files: rolled,
    rolledBack: true,
    fixed: false,
    validation: await opts.validate(rolled),
    notes,
  };
}

/** Pick the most relevant files for edit context. */
export function selectEditContext(
  request: string,
  files: Record<string, string>,
  maxFiles = 12,
  maxChars = 3500,
): string[] {
  const keys = Object.keys(files);
  const req = request.toLowerCase();
  const scored = keys.map((path) => {
    let score = 0;
    const lower = path.toLowerCase();
    if (/src\/App\.tsx?$/.test(path)) score += 50;
    if (/src\/main\.tsx?$/.test(path)) score += 20;
    if (path.endsWith("package.json")) score += 15;
    if (/\.(tsx|jsx)$/.test(path)) score += 10;
    for (const word of req.split(/\W+/).filter((w) => w.length > 3)) {
      if (lower.includes(word)) score += 8;
      const body = files[path] || "";
      if (body.toLowerCase().includes(word)) score += 3;
    }
    if (path.startsWith("compliance/")) score -= 20;
    return { path, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const picked = scored.slice(0, maxFiles);
  return picked.map(({ path }) => {
    const body = files[path] ?? "";
    const clipped =
      body.length > maxChars
        ? `${body.slice(0, maxChars)}\n/* …truncated… */`
        : body;
    return `// filename: ${path}\n${clipped}`;
  });
}
