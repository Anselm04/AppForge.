import { invalidatePreviewCache } from "../routes/livePreview.js";
import { invokeLLM } from "../_core/llm.js";
import { updateProjectFiles, getProjectFiles } from "../db.js";
import { modelForAgent } from "../lib/llmModels.js";
import { validateProjectFiles } from "../lib/buildValidationHelpers.js";
import type { ValidationResult } from "../agents/buildValidator.js";
import {
  applyPatches,
  ensureIterateGreen,
  selectEditContext,
  type IteratePatch,
} from "../lib/iterateReliable.js";
import { parseGeneratedFiles } from "./multiFileCoder.js";
import { goldenCoderRules } from "../lib/reliableBuild.js";
import { requireExplicitStack } from "../lib/stackDefaults.js";
import { getStackAdapter } from "../lib/stackAdapters.js";

export type QuickEditPatch = IteratePatch;

export type QuickEditResult = {
  summary: string;
  filesChanged: string[];
  patches: QuickEditPatch[];
  validation?: ValidationResult;
  rolledBack?: boolean;
  fixed?: boolean;
};

/**
 * Quick Edit instructions for the project's own stack adapter. The edit must
 * keep the adapter's language, framework and entrypoints — never convert the
 * project to another stack.
 */
export function quickEditSystemPrompt(techStack: string): string {
  const adapter = getStackAdapter(techStack);
  return `You are AppForge Quick Edit — surgical chat-to-edit for an existing ${adapter.label} project.
Given the user request and current files, return precise file patches only.
Rules:
- Minimal focused changes; prefer modify over create
- Match the existing code style and stay on ${adapter.label}; do NOT switch framework or language
- Do NOT add dependencies to ${adapter.dependencyManifest} unless explicitly requested
- Keep the project building; preserve entrypoints (${adapter.entrypoints.join(", ")})
- Return ONLY valid JSON: { "summary": string, "patches": [{ "path", "action": "create"|"modify"|"delete", "content"? }] }
- For modify/create, content must be the FULL file body
${goldenCoderRules(techStack)}`;
}

async function surgicalIterateFix(
  files: Record<string, string>,
  errors: string[],
  techStack: string,
): Promise<Record<string, string>> {
  const errorBlock = errors.slice(0, 10).join("\n");
  const sample = selectEditContext(errorBlock, files, 6, 3000).join("\n\n");
  const response = await invokeLLM({
    model: modelForAgent("coder"),
    messages: [
      {
        role: "system",
        content: `You fix compile errors after a chat edit. Output ONLY corrected files as // filename: path then full body.\n${goldenCoderRules(techStack)}`,
      },
      {
        role: "user",
        content: `ERRORS:\n${errorBlock}\n\nFILES:\n${sample}`,
      },
    ],
    maxTokens: 4000,
  });
  const raw =
    typeof response.choices[0]?.message?.content === "string"
      ? response.choices[0].message.content
      : "";
  return parseGeneratedFiles(raw);
}

export async function runQuickEdit(params: {
  projectId: number;
  request: string;
  techStack?: string | null;
}): Promise<QuickEditResult> {
  const techStack = requireExplicitStack(params.techStack);
  const baseline = await getProjectFiles(params.projectId);
  const fileList = Object.keys(baseline).sort();
  if (fileList.length === 0) {
    return {
      summary: "No project files yet — complete a build first.",
      filesChanged: [],
      patches: [],
    };
  }

  const contextSample = selectEditContext(params.request, baseline);

  const response = await invokeLLM({
    model: modelForAgent("coder"),
    messages: [
      { role: "system", content: quickEditSystemPrompt(techStack) },
      {
        role: "user",
        content: `Tech stack: ${techStack}
User request: ${params.request}

Project files (${fileList.length} total; most relevant shown):
${contextSample.join("\n\n")}

Respond with JSON only.`,
      },
    ],
    maxTokens: 4000,
  });

  const rawText =
    typeof response.choices[0]?.message?.content === "string"
      ? response.choices[0].message.content
      : "";
  let parsed: { summary?: string; patches?: QuickEditPatch[] } = {};
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    parsed = jsonMatch
      ? JSON.parse(jsonMatch[0])
      : { summary: rawText.slice(0, 500), patches: [] };
  } catch {
    parsed = {
      summary: rawText.slice(0, 500) || "Could not parse edits.",
      patches: [],
    };
  }

  const patches = (parsed.patches ?? []).filter(
    (p) => p.path && ["create", "modify", "delete"].includes(p.action),
  );

  if (patches.length === 0) {
    return {
      summary: parsed.summary ?? "No file changes proposed.",
      filesChanged: [],
      patches: [],
    };
  }

  const candidate = applyPatches(baseline, patches);

  const outcome = await ensureIterateGreen({
    baseline,
    candidate,
    techStack,
    validate: (files) =>
      validateProjectFiles(files, techStack, { testsBlocking: false }),
    surgicalFix: (files, errors) =>
      surgicalIterateFix(files, errors, techStack),
    maxFixAttempts: 2,
  });

  await updateProjectFiles(params.projectId, outcome.files);
  invalidatePreviewCache(params.projectId);

  const filesChanged = patches.map((p) => p.path);
  let summary = parsed.summary ?? `Updated ${filesChanged.length} file(s).`;
  if (outcome.rolledBack) {
    summary = `${summary} Edit broke the build after fix attempts — rolled back to last green version.`;
  } else if (outcome.fixed) {
    summary = `${summary} Auto-fixed compile issues after edit.`;
  } else if (outcome.validation?.passed) {
    summary = `${summary} Sandbox validation passed.`;
  }

  return {
    summary,
    filesChanged: outcome.rolledBack ? [] : filesChanged,
    patches: outcome.rolledBack ? [] : patches,
    validation: outcome.validation ?? undefined,
    rolledBack: outcome.rolledBack,
    fixed: outcome.fixed,
  };
}
