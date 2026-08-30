import { invokeLLM } from "../_core/llm.js";
import type { Message } from "../_core/llm.js";
import { logger } from "../_core/logger.js";
import { validateProjectFiles } from "../lib/buildValidationHelpers.js";
import {
  hardenAfterIterate,
  ensureIterateGreen,
} from "../lib/iterateReliable.js";
import { preferReactNodeStack } from "../lib/stackDefaults.js";

// ── Types ──

export type PlanStep = {
  step: number;
  title: string;
  files: string[];
  action: "create" | "modify" | "delete" | "refactor" | "test";
  reason: string;
};

export type AgentPlan = {
  approach: string;
  steps: PlanStep[];
  estimatedCredits: number;
};

export type FileChange = {
  path: string;
  action: "create" | "modify" | "delete";
  content?: string;
  diff?: string;
};

export type ValidationResult = {
  stage: "syntax" | "types" | "tests" | "lint";
  passed: boolean;
  errors: string[];
  warnings: string[];
};

export type AgentState =
  | "planning"
  | "awaiting_approval"
  | "executing"
  | "validating"
  | "fixing"
  | "completed"
  | "failed"
  | "cancelled";

export type SeniorDevTask = {
  id: number;
  projectId: number;
  userId: number;
  request: string;
  mode: "collaborative" | "autonomous";
  plan: AgentPlan | null;
  planApproved: boolean;
  status: AgentState;
  changes: FileChange[];
  validationResults: ValidationResult[];
  summary: string;
  creditsSpent: number;
};

export type ProgressEvent = {
  stage: AgentState;
  message: string;
  detail?: Record<string, unknown>;
};

const CREDIT_COSTS = {
  context: 1,
  plan: 2,
  execute_per_step: 3,
  validate: 2,
  fix_attempt: 2,
  summary: 1,
};

const MAX_FIX_RETRIES = 2;

const CONTEXT_SYSTEM_PROMPT = `You are a senior software engineer analysing an AppForge-generated project.
Read the file structure, tech stack, naming conventions, and patterns.
Summarize:
1. Tech stack and framework versions
2. Architecture (routing, state management, data layer)
3. Naming conventions (files, functions, types)
4. Existing patterns (hooks, middleware, validation)
5. Areas that might need attention or are incomplete
Be concise. No fluff.`;

const PLAN_SYSTEM_PROMPT = `You are a senior software engineer planning a clean, focused implementation.
Given the project context and user request, create a step-by-step plan.
Each step must specify:
- Which file(s) to create, modify, or delete
- The action type
- A one-sentence reason
- Keep changes small and reviewable
- NEVER introduce new libraries unless the user explicitly asked
- Match existing naming conventions and patterns
- Prefer editing existing files over creating new ones
Return JSON with: approach (brief strategy), steps (array), estimatedCredits (rough guess 1-10).`;

const EXECUTE_SYSTEM_PROMPT = `You are a senior software engineer implementing a planned change.
Given the plan step and current file contents, produce the updated file(s).
Rules:
- Write production-quality, clean code
- Match the existing style exactly (imports, formatting, patterns)
- Only modify what's needed for this step
- Return the COMPLETE new file content for any modified or created files
- If deleting, return empty content
- Do not add unnecessary comments
- Use the same tech stack; no new dependencies
Return JSON: { changes: [{ path, action, content }] }`;

const VALIDATE_SYSTEM_PROMPT = `You are a senior software engineer validating code changes.
Given the original files and the new files, check for:
1. Syntax errors or broken imports
2. Type consistency (matching existing types)
3. Logic errors or missing edge cases
4. Broken references (renamed things not updated everywhere)
5. Style drift (new code looks different from old code)
Return JSON: { stage: "syntax|types|tests|lint", passed: boolean, errors: [], warnings: [] }`;

const FIX_SYSTEM_PROMPT = `You are a senior software engineer fixing broken code.
Given the validation errors and the current file contents, fix the issues.
Rules:
- Minimal, surgical fixes
- Do not rewrite entire files unless necessary
- Preserve existing patterns
- Return JSON: { changes: [{ path, action, content }] }`;

const SUMMARY_SYSTEM_PROMPT = `You are a senior software engineer wrapping up a task.
Given the plan, changes made, and validation results, write a clear summary.
Format:
- What was built/changed (bullet list)
- Which files were created or modified (explicit paths)
- What the user should test next
- Any known limitations or follow-up tasks
Keep it under 200 words. Be direct.`;

function extractJSON<T>(text: string): T {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in LLM response");
  return JSON.parse(match[0]) as T;
}

function trackCredits(
  task: SeniorDevTask,
  costKey: keyof typeof CREDIT_COSTS,
  multiplier = 1,
): void {
  const cost = CREDIT_COSTS[costKey] * multiplier;
  task.creditsSpent += cost;
  logger.info(
    { taskId: task.id, cost, total: task.creditsSpent },
    "senior_dev_credit_usage",
  );
}

export async function gatherContext(
  files: Record<string, string>,
  techStack: string,
  onProgress: (e: ProgressEvent) => void,
): Promise<string> {
  onProgress({
    stage: "planning",
    message: "Reading project structure and existing patterns...",
  });

  const fileList = Object.keys(files).slice(0, 40).join("\n");
  const sampleFiles = Object.entries(files)
    .slice(0, 8)
    .map(([path, content]) => `--- ${path} ---\n${content.slice(0, 800)}`)
    .join("\n\n");

  const messages: Message[] = [
    { role: "system", content: CONTEXT_SYSTEM_PROMPT },
    {
      role: "user",
      content: `Tech stack: ${techStack}\n\nFiles:\n${fileList}\n\nSample contents:\n${sampleFiles}`,
    },
  ];

  const result = await invokeLLM({ messages, maxTokens: 1500 });
  const text = result.choices[0]?.message?.content ?? "";
  return typeof text === "string" ? text : JSON.stringify(text);
}

export async function createPlan(
  task: SeniorDevTask,
  context: string,
  onProgress: (e: ProgressEvent) => void,
): Promise<AgentPlan> {
  onProgress({ stage: "planning", message: "Creating implementation plan..." });

  const messages: Message[] = [
    { role: "system", content: PLAN_SYSTEM_PROMPT },
    {
      role: "user",
      content: `Project context:\n${context}\n\nUser request: ${task.request}\n\nMode: ${task.mode}`,
    },
  ];

  const result = await invokeLLM({
    messages,
    maxTokens: 2000,
    responseFormat: { type: "json_object" },
  });

  const text = result.choices[0]?.message?.content ?? "";
  const raw = typeof text === "string" ? text : JSON.stringify(text);
  const plan = extractJSON<AgentPlan>(raw);
  trackCredits(task, "plan");

  onProgress({
    stage: task.mode === "collaborative" ? "awaiting_approval" : "executing",
    message: `Plan ready: ${plan.steps.length} steps. ${task.mode === "collaborative" ? "Waiting for your approval." : "Proceeding automatically."}`,
    detail: { approach: plan.approach, steps: plan.steps },
  });

  return plan;
}

export async function executePlan(
  task: SeniorDevTask,
  plan: AgentPlan,
  files: Record<string, string>,
  onProgress: (e: ProgressEvent) => void,
): Promise<FileChange[]> {
  const allChanges: FileChange[] = [];

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    onProgress({
      stage: "executing",
      message: `Step ${i + 1}/${plan.steps.length}: ${step.title}`,
      detail: { step, files: step.files },
    });

    const currentFiles: Record<string, string> = {};
    for (const f of step.files) {
      currentFiles[f] = files[f] ?? "";
    }

    const messages: Message[] = [
      { role: "system", content: EXECUTE_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Plan step: ${step.title}\nAction: ${step.action}\nReason: ${step.reason}\n\nCurrent file contents:\n${JSON.stringify(currentFiles, null, 2)}`,
      },
    ];

    const result = await invokeLLM({
      messages,
      maxTokens: 4000,
      responseFormat: { type: "json_object" },
    });

    const text = result.choices[0]?.message?.content ?? "";
    const raw = typeof text === "string" ? text : JSON.stringify(text);
    const stepResult = extractJSON<{ changes: FileChange[] }>(raw);

    for (const change of stepResult.changes) {
      allChanges.push(change);
      if (change.action === "delete") {
        delete files[change.path];
      } else if (change.content !== undefined) {
        files[change.path] = change.content;
      }
    }

    trackCredits(task, "execute_per_step");
  }

  onProgress({
    stage: "validating",
    message: `Executed ${plan.steps.length} steps. Running validation...`,
    detail: { filesModified: allChanges.map((c) => c.path) },
  });

  return allChanges;
}

export async function validateWork(
  task: SeniorDevTask,
  originalFiles: Record<string, string>,
  newFiles: Record<string, string>,
  techStack: string,
  onProgress: (e: ProgressEvent) => void,
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  const changedPaths = Object.keys(newFiles).filter(
    (p) => originalFiles[p] !== newFiles[p] || !originalFiles[p],
  );

  if (changedPaths.length === 0) {
    onProgress({ stage: "validating", message: "No changes to validate." });
    return [{ stage: "syntax", passed: true, errors: [], warnings: [] }];
  }

  onProgress({
    stage: "validating",
    message: "Running sandbox compile validation on changed project…",
  });

  const sandboxResult = await validateProjectFiles(newFiles, techStack, {
    testsBlocking: true,
  });

  results.push({
    stage: sandboxResult.stage as ValidationResult["stage"],
    passed: sandboxResult.passed,
    errors: sandboxResult.errors,
    warnings: sandboxResult.warning ? [sandboxResult.warning] : [],
  });

  if (!sandboxResult.passed) {
    onProgress({
      stage: "fixing",
      message: `Sandbox validation failed: ${sandboxResult.errors.slice(0, 2).join("; ")}`,
      detail: { validation: sandboxResult },
    });
    trackCredits(task, "validate");
    return results;
  }

  const before: Record<string, string> = {};
  const after: Record<string, string> = {};
  for (const p of changedPaths) {
    before[p] = originalFiles[p] ?? "(did not exist)";
    after[p] = newFiles[p];
  }

  onProgress({
    stage: "validating",
    message: "LLM consistency review on changed files…",
  });

  const messages: Message[] = [
    { role: "system", content: VALIDATE_SYSTEM_PROMPT },
    {
      role: "user",
      content: `Original files:\n${JSON.stringify(before, null, 2)}\n\nNew files:\n${JSON.stringify(after, null, 2)}`,
    },
  ];

  const result = await invokeLLM({
    messages,
    maxTokens: 2000,
    responseFormat: { type: "json_object" },
  });

  const text = result.choices[0]?.message?.content ?? "";
  const raw = typeof text === "string" ? text : JSON.stringify(text);
  const validation = extractJSON<ValidationResult>(raw);
  results.push(validation);
  trackCredits(task, "validate");

  onProgress({
    stage: validation.passed ? "completed" : "fixing",
    message: validation.passed
      ? "Validation passed."
      : `Found ${validation.errors.length} error(s), ${validation.warnings.length} warning(s).`,
    detail: { validation },
  });

  return results;
}

export async function fixIssues(
  task: SeniorDevTask,
  validation: ValidationResult,
  files: Record<string, string>,
  onProgress: (e: ProgressEvent) => void,
  attempt: number,
): Promise<FileChange[]> {
  onProgress({
    stage: "fixing",
    message: `Fix attempt ${attempt}/${MAX_FIX_RETRIES}: ${validation.errors.join("; ")}`,
    detail: { errors: validation.errors, attempt },
  });

  const relevantFiles: Record<string, string> = {};
  for (const err of validation.errors) {
    const pathMatch =
      err.match(/(?:in|file|path) ['"`]([^'"`]+)['"`]/i) ??
      err.match(/^([a-zA-Z0-9_./-]+\.(ts|tsx|js|jsx|py|css|json))/);
    if (pathMatch) {
      const p = pathMatch[1];
      if (files[p]) relevantFiles[p] = files[p];
    }
  }
  if (Object.keys(relevantFiles).length === 0) {
    for (const p of Object.keys(files).slice(0, 10))
      relevantFiles[p] = files[p];
  }

  const messages: Message[] = [
    { role: "system", content: FIX_SYSTEM_PROMPT },
    {
      role: "user",
      content: `Errors to fix:\n${validation.errors.join("\n")}\n\nWarnings:\n${validation.warnings.join("\n")}\n\nCurrent file contents:\n${JSON.stringify(relevantFiles, null, 2)}`,
    },
  ];

  const result = await invokeLLM({
    messages,
    maxTokens: 4000,
    responseFormat: { type: "json_object" },
  });

  const text = result.choices[0]?.message?.content ?? "";
  const raw = typeof text === "string" ? text : JSON.stringify(text);
  const fixResult = extractJSON<{ changes: FileChange[] }>(raw);

  for (const change of fixResult.changes) {
    if (change.content !== undefined) {
      files[change.path] = change.content;
    }
  }

  trackCredits(task, "fix_attempt");

  onProgress({
    stage: "validating",
    message: `Fix attempt ${attempt} applied. Re-validating...`,
    detail: { fixFiles: fixResult.changes.map((c) => c.path) },
  });

  return fixResult.changes;
}

export async function generateSummary(
  task: SeniorDevTask,
  plan: AgentPlan,
  changes: FileChange[],
  validations: ValidationResult[],
  onProgress: (e: ProgressEvent) => void,
): Promise<string> {
  onProgress({ stage: "completed", message: "Generating task summary..." });

  const allPassed = validations.every((v) => v.passed);
  const totalErrors = validations.reduce((sum, v) => sum + v.errors.length, 0);

  const messages: Message[] = [
    { role: "system", content: SUMMARY_SYSTEM_PROMPT },
    {
      role: "user",
      content: `Plan approach: ${plan.approach}\n\nChanges made:\n${changes.map((c) => `- ${c.action}: ${c.path}`).join("\n")}\n\nValidation: ${allPassed ? "all passed" : `${totalErrors} errors remaining`}\n\nOriginal request: ${task.request}`,
    },
  ];

  const result = await invokeLLM({ messages, maxTokens: 1500 });
  const text = result.choices[0]?.message?.content ?? "";
  const summary = typeof text === "string" ? text : JSON.stringify(text);
  trackCredits(task, "summary");

  onProgress({
    stage: "completed",
    message: "Task complete.",
    detail: { summary, creditsSpent: task.creditsSpent },
  });

  return summary;
}

export async function runSeniorDevAgent(
  task: SeniorDevTask,
  generatedFiles: Record<string, string>,
  techStack: string,
  onProgress: (e: ProgressEvent) => void,
): Promise<{
  files: Record<string, string>;
  changes: FileChange[];
  validations: ValidationResult[];
  summary: string;
}> {
  logger.info(
    { taskId: task.id, request: task.request, mode: task.mode },
    "senior_dev_start",
  );

  try {
    let context = "";

    if (!(task.planApproved && task.plan)) {
      trackCredits(task, "context");
      context = await gatherContext(generatedFiles, techStack, onProgress);
      task.plan = await createPlan(task, context, onProgress);

      if (task.mode === "collaborative" && !task.planApproved) {
        task.status = "awaiting_approval";
        logger.info({ taskId: task.id }, "senior_dev_awaiting_approval");
        return {
          files: generatedFiles,
          changes: [],
          validations: [],
          summary: "Plan created. Awaiting user approval before executing.",
        };
      }
    } else {
      onProgress({
        stage: "executing",
        message: "Resuming with approved plan — skipping re-plan.",
      });
    }

    if (!task.plan) {
      throw new Error("No plan available to execute");
    }

    task.status = "executing";
    const originalFiles = { ...generatedFiles };
    const changes = await executePlan(
      task,
      task.plan,
      generatedFiles,
      onProgress,
    );
    task.changes = changes;

    techStack = preferReactNodeStack(techStack);
    Object.assign(generatedFiles, hardenAfterIterate(generatedFiles, techStack));
    onProgress({
      stage: "validating",
      message: "Hardened post-edit tree (entrypoints, deps, file cap)…",
    });

    task.status = "validating";
    let validations = await validateWork(
      task,
      originalFiles,
      generatedFiles,
      techStack,
      onProgress,
    );

    const { runTripleAudit } = await import("./tripleAudit.js");
    const audit = await runTripleAudit(generatedFiles);
    onProgress({
      stage: "validating",
      message: `Triple audit complete: a11y ${audit.a11y.score}/100, security ${audit.security.score}/100, perf ${audit.perf.score}/100.`,
      detail: { auditScores: audit },
    });

    for (let attempt = 1; attempt <= MAX_FIX_RETRIES; attempt++) {
      const lastValidation = validations[validations.length - 1];
      if (lastValidation.passed || lastValidation.errors.length === 0) break;

      task.status = "fixing";
      const fixChanges = await fixIssues(
        task,
        lastValidation,
        generatedFiles,
        onProgress,
        attempt,
      );
      task.changes.push(...fixChanges);

      const revalidation = await validateWork(
        task,
        originalFiles,
        generatedFiles,
        techStack,
        onProgress,
      );
      validations.push(...revalidation);
    }

    task.validationResults = validations;
    let finalPassed = validations[validations.length - 1]?.passed ?? false;

    if (!finalPassed) {
      onProgress({
        stage: "fixing",
        message: "Edits still failing validation — restoring last green snapshot…",
      });
      const outcome = await ensureIterateGreen({
        baseline: originalFiles,
        candidate: generatedFiles,
        techStack,
        validate: async (files) => {
          const r = await validateProjectFiles(files, techStack, {
            testsBlocking: false,
          });
          return {
            stage: (r.stage as ValidationResult["stage"]) || "syntax",
            passed: r.passed,
            errors: r.errors,
            warnings: r.warning ? [r.warning] : [],
          };
        },
        maxFixAttempts: 1,
      });
      Object.keys(generatedFiles).forEach((k) => delete generatedFiles[k]);
      Object.assign(generatedFiles, outcome.files);
      if (outcome.rolledBack) {
        finalPassed = true;
        task.summary =
          (task.summary || "") +
          " Changes could not be applied cleanly; restored previous green files.";
        onProgress({
          stage: "completed",
          message: "Rolled back to last green project files.",
        });
      } else if (outcome.validation?.passed) {
        finalPassed = true;
      }
    }

    task.status = finalPassed ? "completed" : "failed";

    const summary = await generateSummary(
      task,
      task.plan,
      task.changes,
      validations,
      onProgress,
    );
    task.summary = summary;

    logger.info(
      { taskId: task.id, status: task.status, credits: task.creditsSpent },
      "senior_dev_complete",
    );

    return {
      files: generatedFiles,
      changes: task.changes,
      validations: task.validationResults,
      summary,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    task.status = "failed";
    task.summary = `Failed: ${message}`;
    logger.error({ taskId: task.id, error: message }, "senior_dev_error");
    onProgress({ stage: "failed", message: `Agent failed: ${message}` });
    throw err;
  }
}

export async function resumeAfterApproval(
  task: SeniorDevTask,
  generatedFiles: Record<string, string>,
  techStack: string,
  onProgress: (e: ProgressEvent) => void,
): Promise<{
  files: Record<string, string>;
  changes: FileChange[];
  validations: ValidationResult[];
  summary: string;
}> {
  if (!task.plan) throw new Error("No plan available to resume");
  task.planApproved = true;
  return runSeniorDevAgent(task, generatedFiles, techStack, onProgress);
}
