import { invalidatePreviewCache } from "../routes/livePreview.js";
import { invokeLLM } from "../_core/llm.js";
import { updateProjectFiles, getProjectFiles } from "../db.js";
import { modelForAgent } from "../lib/llmModels.js";
import {
  buildEditContextSample,
  validateProjectFiles,
} from "../lib/buildValidationHelpers.js";
import type { ValidationResult } from "../agents/buildValidator.js";

export type QuickEditPatch = {
  path: string;
  action: "create" | "modify" | "delete";
  content?: string;
};

export type QuickEditResult = {
  summary: string;
  filesChanged: string[];
  patches: QuickEditPatch[];
  validation?: ValidationResult;
};

const SYSTEM = `You are AppForge Quick Edit — a fast code assistant that patches project files.
Given the user's request and current files, return precise file edits.
Rules:
- Prefer minimal, focused changes
- Match existing code style and stack
- Use shadcn/Tailwind patterns for UI when relevant
- Return ONLY valid JSON matching the schema
- Do not add new npm dependencies unless explicitly requested`;

export async function runQuickEdit(params: {
  projectId: number;
  request: string;
  techStack?: string | null;
}): Promise<QuickEditResult> {
  const files = await getProjectFiles(params.projectId);
  const fileList = Object.keys(files).sort();
  if (fileList.length === 0) {
    return {
      summary: "No project files yet — complete a build first.",
      filesChanged: [],
      patches: [],
    };
  }

  const contextSample = buildEditContextSample(params.request, files, 16, 4000);

  const response = await invokeLLM({
    model: modelForAgent("coder"),
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Tech stack: ${params.techStack ?? "react-node"}
User request: ${params.request}

Project files (${fileList.length} total; most relevant shown):
${contextSample.join("\n\n")}

Respond with JSON only: { "summary": string, "patches": [{ "path": string, "action": "create"|"modify"|"delete", "content"?: string }] }`,
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

  const nextFiles = { ...files };
  for (const patch of patches) {
    const safePath = patch.path.replace(/^\/+/, "");
    if (patch.action === "delete") {
      delete nextFiles[safePath];
    } else if (patch.content !== undefined) {
      nextFiles[safePath] = patch.content;
    }
  }

  let validation: ValidationResult | undefined;
  if (patches.length > 0) {
    await updateProjectFiles(params.projectId, nextFiles);
    invalidatePreviewCache(params.projectId);
    validation = await validateProjectFiles(nextFiles, params.techStack, {
      testsBlocking: false,
    });
  }

  const filesChanged = patches.map((p) => p.path);
  const validationNote = validation
    ? validation.passed
      ? " Sandbox validation passed."
      : ` Validation warnings: ${validation.errors.slice(0, 2).join("; ")}`
    : "";

  return {
    summary: `${parsed.summary ?? `Updated ${filesChanged.length} file(s).`}${validationNote}`,
    filesChanged,
    patches,
    validation,
  };
}
