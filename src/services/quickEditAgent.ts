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
import { preferReactNodeStack } from "../lib/stackDefaults.js";

export type QuickEditPatch = IteratePatch;

export type QuickEditResult = {
  summary: string;
  filesChanged: string[];
  patches: QuickEditPatch[];
  validation?: ValidationResult;
  rolledBack?: boolean;
  fixed?: boolean;
};

const SYSTEM = `You are AppForge Quick Edit — surgical chat-to-edit for a running app.
Given the user request and current files, return precise file patches only.
Rules:
- Minimal focused changes; prefer modify over create
- Match existing style (React 18, TypeScript, Tailwind)
- Do NOT add npm dependencies unless explicitly requested
- Keep the app compiling; preserve entrypoints (src/App.tsx, src/main.tsx, index.html)
- Return ONLY valid JSON: { "summary": string, "patches": [{ "path", "action": "create"|"modify"|"delete", "content"? }] }
- For modify/create, content must be the FULL file body`;

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
  const techStack = preferReactNodeStack(params.techStack);
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
      { role: "system", content: SYSTEM },
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
