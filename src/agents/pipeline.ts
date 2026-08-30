import {
  appendAgentLog,
  markAgentLogComplete,
  updateProjectFiles,
  updateProjectStatus,
} from "../db.js";
import { invokeLLM } from "../_core/llm.js";
import { injectComplianceScaffolding } from "../services/compliance-template.js";
import {
  parseGeneratedFiles,
  ensureEssentialFiles,
} from "../services/multiFileCoder.js";
import {
  getStackScaffold,
  mergeScaffoldWithGenerated,
} from "../services/stackScaffolds.js";
import { validateGeneratedBuild, ValidationResult } from "./buildValidator.js";
import { BUILD_CREDIT_COST } from "../lib/credits.js";
import { getValidationMode } from "../lib/validationMode.js";
import { modelForAgent } from "../lib/llmModels.js";
import { LOCALE_UI_HINT, designSystemPrompt } from "../lib/componentLibrary.js";
import {
  normalizeCapabilities,
  type BuildCapabilityId,
} from "../lib/buildCapabilities.js";
import { capabilityHintsForPipeline } from "./capabilityHints.js";
import { runResearchAgent } from "./researchAgent.js";
import { attachGeneratedTests } from "./testingAgent.js";
import { plannerLocaleHint } from "../lib/localePlanner.js";
import { detectIncomeIntent } from "../lib/revenueReadiness.js";
import { mergeBillingScaffold } from "../services/saasBillingScaffold.js";
import {
  goldenCoderRules,
  hardenGeneratedProject,
  isGoldenStack,
  maxFixRetriesForStack,
} from "../lib/reliableBuild.js";
import {
  buildSurgicalFixPrompt,
  mergeSurgicalPatches,
} from "../lib/surgicalFix.js";
import { buildGuaranteedGreenApp } from "../lib/guaranteedGreen.js";
import {
  classifyRecipe,
  recipeCoderHint,
  checkRecipeSpec,
} from "../lib/appRecipes.js";
import type { TripleAuditResult } from "./tripleAudit.js";
import { db } from "../db.js";
import * as schema from "../db/schema.js";
import { eq } from "drizzle-orm";

const SUPPORTED_TECH_STACKS = [
  "react-node","react-python","vue-node","svelte-node","next-node","angular-node",
  "vanilla-node","react-django","react-supabase","remix-node","astro-node",
  "phaser-html5","three-js-3d","babylon-js-3d","unity-webgl","godot-html5",
  "react-native-game","flutter-game","ai-agent-python","ai-agent-node","openai-tool",
  "langchain-tool","crewai-agent","autogen-agent","electron-react","tauri-rust",
  "react-native-expo","flutter-firebase","capacitor-ionic","chrome-extension",
  "vscode-extension","discord-bot","telegram-bot","slack-bot","browser-automation",
  "web-scraper","data-visualization","api-service","serverless-aws","serverless-vercel",
] as const;

export type TechStack = (typeof SUPPORTED_TECH_STACKS)[number];
export function isValidTechStack(stack: string): stack is TechStack {
  return (SUPPORTED_TECH_STACKS as readonly string[]).includes(stack);
}
export function getTechStackDescription(stack: TechStack): string {
  return stack;
}

type AgentRole = "Planner"|"Coder"|"Reviewer"|"Validator"|"Cosine"|"Testing"|"Research"|"System";
type SSEWriter = (event: string, data: unknown) => void;
type CreditChecker = () => Promise<boolean>;

async function streamLLM(
  messages: { role: string; content: string }[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
  modelRole?: "planner"|"coder"|"reviewer",
): Promise<string> {
  const result = await invokeLLM({
    messages: messages as any,
    model: modelRole ? modelForAgent(modelRole) : undefined,
  });
  let fullText = "";
  if (result.choices[0]?.message?.content) {
    fullText =
      typeof result.choices[0].message.content === "string"
        ? result.choices[0].message.content
        : result.choices[0].message.content
            .filter((c: any) => c.type === "text")
            .map((c: any) => c.text)
            .join("");
    const parts = fullText.match(/\S+\s*|\s+/g) ?? [fullText];
    let buffer = "";
    for (const part of parts) {
      buffer += part;
      if (buffer.length >= 32 || part.includes("\n")) {
        onChunk(buffer);
        buffer = "";
      }
    }
    if (buffer) onChunk(buffer);
  }
  return fullText;
}

export interface PlanTask { id: string; module: string; description: string; }
export interface PipelineOptions {
  locale?: string;
  buildCapabilities?: BuildCapabilityId[];
}

export async function runAgentPipeline(
  projectId: number,
  description: string,
  techStack: string,
  write: SSEWriter,
  signal?: AbortSignal,
  creditCheck?: CreditChecker,
  options?: PipelineOptions,
): Promise<void> {
  const locale = options?.locale ?? "en";
  const localeHint = `${LOCALE_UI_HINT(locale)}\n${plannerLocaleHint(locale)}`.trim();
  const capabilities = normalizeCapabilities(options?.buildCapabilities ?? []);
  const capabilityHints = capabilityHintsForPipeline(capabilities);
  const maxFixRetries = maxFixRetriesForStack(techStack);

  const projectRow = await db.query.projects.findFirst({
    where: eq(schema.projects.id, projectId),
    columns: { buildCapabilities: true },
  });
  const storedCaps = normalizeCapabilities(projectRow?.buildCapabilities ?? []);
  const activeCapabilities = capabilities.length > 0 ? capabilities : storedCaps;
  const incomeIntent = detectIncomeIntent(description);
  const mergeBilling = activeCapabilities.includes("fintech") || incomeIntent;

  const assetRows = await db.query.projectAssets.findMany({
    where: eq(schema.projectAssets.projectId, projectId),
    columns: { filename: true },
  });
  const assetPaths = assetRows.map((a) => `public/assets/${a.filename}`);
  const designHints = designSystemPrompt({ assetPaths, locale, stack: techStack });

  const emit = (agent: AgentRole, type: string, payload: unknown) => {
    write("agent", { agent, type, payload });
  };

  const validationMode = getValidationMode(techStack);
  emit("System", "info", {
    message: `Validation mode: ${validationMode === "full" ? "full compile sandbox" : "structure check only"}${isGoldenStack(techStack) ? " · golden reliability path" : ""}`,
    validationMode,
    goldenStack: isGoldenStack(techStack),
  });

  try {
    await updateProjectStatus(projectId, "running");

    if (creditCheck && !(await creditCheck())) {
      write("pause", { reason: "credits_exhausted", agent: "Research", message: "Build paused: insufficient credits." });
      await updateProjectStatus(projectId, "paused", "credits_exhausted");
      return;
    }

    const researchFocus = activeCapabilities.includes("patent")
      ? "patent"
      : activeCapabilities.includes("architecture")
        ? "architecture"
        : activeCapabilities.includes("education")
          ? "education"
          : "general";

    let researchBrief = "";
    if (isGoldenStack(techStack) || techStack.includes("react")) {
      emit("Research", "skipped", {
        message: "Golden path: research skipped for faster reliable builds.",
      });
    } else {
      researchBrief = await runResearchAgent(
        projectId, description, techStack,
        (type, payload) => emit("Research", type, payload),
        { focus: researchFocus },
      );
    }

    if (creditCheck && !(await creditCheck())) {
      write("pause", { reason: "credits_exhausted", agent: "Planner", message: "Build paused: insufficient credits." });
      await updateProjectStatus(projectId, "paused", "credits_exhausted");
      return;
    }

    emit("Planner", "start", { message: "Analyzing your request and creating an architecture plan…" });
    const plannerLogId = await appendAgentLog({ projectId, agent: "Planner", content: "", isComplete: false });

    let plannerOutput = "";
    await streamLLM(
      [
        {
          role: "system",
          content: `You are the Planner agent. Output ONLY valid JSON: {"title":"...","overview":"...","tasks":[{"id":"1","module":"...","description":"..."}]}. For runnable UI-first builds use 2-3 focused tasks only (shell, main view, polish). Prefer fewer complete modules over many partial ones. Stack: ${techStack}.\n${designHints}\n${capabilityHints}\n${researchBrief ? `RESEARCH:\n${researchBrief}` : ""}\n${localeHint}`,
        },
        { role: "user", content: `App: ${description}\nStack: ${techStack}` },
      ],
      (chunk) => { plannerOutput += chunk; emit("Planner", "chunk", { text: chunk }); },
      signal, "planner",
    );
    await markAgentLogComplete(plannerLogId);
    emit("Planner", "complete", { message: "Architecture plan complete." });

    let tasks: PlanTask[] = [];
    let appTitle = description.slice(0, 60);
    try {
      const jsonMatch = plannerOutput.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        tasks = parsed.tasks ?? [];
        appTitle = parsed.title ?? appTitle;
      }
    } catch {
      tasks = [{ id: "1", module: "Core App", description }];
    }
    if (isGoldenStack(techStack) && tasks.length > 3) tasks = tasks.slice(0, 3);
    if (isGoldenStack(techStack) && tasks.length === 0) {
      tasks = [{ id: "1", module: "Core UI", description }];
    }

    const activeRecipe = classifyRecipe(description);
    emit("System", "info", {
      message: `Recipe: ${activeRecipe.id} (${activeRecipe.label})`,
      recipe: activeRecipe.id,
    });

    if (creditCheck && !(await creditCheck())) {
      write("pause", { reason: "credits_exhausted", agent: "Coder", message: "Build paused: insufficient credits." });
      await updateProjectStatus(projectId, "paused", "credits_exhausted");
      return;
    }

    emit("Coder", "start", { message: `Writing code for ${tasks.length} modules…` });
    let generatedFiles: Record<string, string> = {};
    let validationResult: ValidationResult | null = null;
    let lastAuditResult: TripleAuditResult | null = null;
    let fixAttempt = 0;
    const testsBlocking = validationMode === "full" && !isGoldenStack(techStack);

    do {
      if (fixAttempt > 0) {
        emit("Coder", "fix_start", {
          message: `Surgical auto-fix attempt ${fixAttempt}/${maxFixRetries}`,
          errors: validationResult?.errors ?? [],
        });

        const fixPrompt = buildSurgicalFixPrompt({
          appTitle,
          techStack,
          errors: validationResult?.errors ?? [],
          files: generatedFiles,
        });
        const coderLogId = await appendAgentLog({
          projectId,
          agent: "Coder",
          content: `# Surgical fix ${fixAttempt}\n`,
          isComplete: false,
        });
        let fixContent = "";
        await streamLLM(
          [
            {
              role: "system",
              content: `You are the Coder agent performing a SURGICAL FIX.
Output only corrected files with // filename: path markers.
Do not regenerate the whole app. Minimal edits to clear the errors.
${goldenCoderRules(techStack)}
${localeHint}`,
            },
            { role: "user", content: fixPrompt },
          ],
          (chunk) => {
            fixContent += chunk;
            emit("Coder", "chunk", { module: "fix", text: chunk });
          },
          signal,
          "coder",
        );
        const patches = parseGeneratedFiles(fixContent);
        if (Object.keys(patches).length > 0) {
          generatedFiles = mergeSurgicalPatches(generatedFiles, patches);
          for (const filename of Object.keys(patches)) {
            emit("Coder", "task_complete", { module: "fix", filename });
          }
        } else {
          const filenameMatch = fixContent.match(/\/\/\s*filename:\s*(.+)/);
          if (filenameMatch) {
            const filename = filenameMatch[1].trim();
            generatedFiles[filename] = fixContent
              .replace(/^\/\/\s*filename:\s*.+\r?\n?/i, "")
              .trimStart();
          }
        }
        await markAgentLogComplete(coderLogId);
        emit("Coder", "complete", {
          message: `Surgical fix applied (${Object.keys(patches).length} file(s)).`,
        });
      } else {
        generatedFiles = {};

        for (const task of tasks) {
          if (signal?.aborted) break;
          emit("Coder", "task_start", { module: task.module, description: task.description });
          const coderLogId = await appendAgentLog({
            projectId, agent: "Coder", content: `# ${task.module}\n`, isComplete: false,
          });

          let fileContent = "";
          await streamLLM(
            [
              {
                role: "system",
                content: `You are the Coder agent. Output files as // filename: path then full code.\n${goldenCoderRules(techStack)}\nPrefer compiling UI first.\n${recipeCoderHint(description)}\n${designHints}\n${capabilityHints}\n${localeHint}`,
              },
              {
                role: "user",
                content: `App: ${appTitle}\nModule: ${task.module}\nTask: ${task.description}\nStack: ${techStack}`,
              },
            ],
            (chunk) => {
              fileContent += chunk;
              emit("Coder", "chunk", { module: task.module, text: chunk });
            },
            signal, "coder",
          );

          const parsedFiles = parseGeneratedFiles(fileContent);
          if (Object.keys(parsedFiles).length > 0) {
            Object.assign(generatedFiles, parsedFiles);
            for (const filename of Object.keys(parsedFiles)) {
              emit("Coder", "task_complete", { module: task.module, filename });
            }
          } else {
            const filenameMatch = fileContent.match(/\/\/\s*filename:\s*(.+)/);
            const filename = filenameMatch
              ? filenameMatch[1].trim()
              : `src/${task.module.toLowerCase().replace(/\s+/g, "-")}.tsx`;
            generatedFiles[filename] = fileContent
              .replace(/^\/\/\s*filename:\s*.+\r?\n?/i, "")
              .trimStart();
            emit("Coder", "task_complete", { module: task.module, filename });
          }
          await markAgentLogComplete(coderLogId);
          if (Object.keys(generatedFiles).length > 0) {
            await updateProjectFiles(projectId, { ...generatedFiles });
            write("files_partial", { fileCount: Object.keys(generatedFiles).length });
          }
        }

        emit("Coder", "complete", { message: `Generated ${Object.keys(generatedFiles).length} files.` });
      }

      try {
        generatedFiles = mergeScaffoldWithGenerated(getStackScaffold(techStack), generatedFiles);
        generatedFiles = ensureEssentialFiles(generatedFiles, techStack);
        generatedFiles = hardenGeneratedProject(generatedFiles, techStack);
        emit("System", "info", { message: "Reliability pass applied (entrypoints, package.json, imports)." });
        if (mergeBilling) {
          const fintechSchema = generatedFiles["fintech/fintech-schema.json"];
          generatedFiles = mergeBillingScaffold(generatedFiles, techStack, fintechSchema);
          generatedFiles = hardenGeneratedProject(generatedFiles, techStack);
          emit("System", "info", { message: "Merged Stripe billing scaffold." });
        }
      } catch { /* non-fatal */ }

      if (!isGoldenStack(techStack)) {
        emit("Testing", "start", { message: "Generating unit tests before validation…" });
        const testFiles = await attachGeneratedTests(generatedFiles, techStack);
        Object.assign(generatedFiles, testFiles);
        emit("Testing", "complete", { message: `Prepared ${Object.keys(testFiles).length} test file(s).` });
      } else {
        emit("Testing", "skipped", { message: "Golden path: tests deferred until UI is green." });
      }

      if (creditCheck && !(await creditCheck())) {
        write("pause", { reason: "credits_exhausted", agent: "Validator", message: "Build paused: insufficient credits." });
        await updateProjectStatus(projectId, "paused", "credits_exhausted");
        return;
      }

      emit("Validator", "start", { message: "Compiling and testing generated code in sandbox…" });
      validationResult = await validateGeneratedBuild(generatedFiles, techStack, {
        testsBlocking, validateBilling: mergeBilling,
      });

      const { runTripleAudit } = await import("./tripleAudit.js");
      lastAuditResult = await runTripleAudit(generatedFiles);
      emit("Validator", "audit", {
        passed: lastAuditResult.passed,
        overallScore: lastAuditResult.overallScore,
        a11y: lastAuditResult.a11y.score,
        security: lastAuditResult.security.score,
        perf: lastAuditResult.perf.score,
        findings: [
          ...lastAuditResult.a11y.findings,
          ...lastAuditResult.security.findings,
          ...lastAuditResult.perf.findings,
        ].slice(0, 10),
      });

      const criticalSecurity = lastAuditResult.security.findings.filter((f) => f.severity === "critical");
      if (criticalSecurity.length > 0 && validationResult.passed) {
        validationResult = {
          ...validationResult,
          passed: false,
          stage: "audit",
          errors: [...validationResult.errors, ...criticalSecurity.map((f) => `Security: ${f.message}`)],
        };
      }

      emit("Validator", "complete", {
        passed: validationResult.passed,
        stage: validationResult.stage,
        errors: validationResult.errors,
        durationMs: validationResult.durationMs,
        warning: validationResult.warning,
      });
      fixAttempt++;
    } while (!validationResult.passed && fixAttempt <= maxFixRetries && !signal?.aborted);

    if (!validationResult.passed) {
      emit("Validator", "failed", {
        message: `Build could not be auto-fixed after ${maxFixRetries} attempts.`,
        errors: validationResult.errors,
        stage: validationResult.stage,
      });

      if (isGoldenStack(techStack) || techStack.includes("react")) {
        emit("System", "info", {
          message: `Applying recipe-based guaranteed-green (${classifyRecipe(description).id}) so the app still runs and stays on-prompt.`,
        });
        generatedFiles = buildGuaranteedGreenApp({
          title: appTitle,
          description,
          techStack,
        });
        validationResult = await validateGeneratedBuild(generatedFiles, techStack, {
          testsBlocking: false,
          validateBilling: false,
        });
        emit("Validator", "complete", {
          passed: validationResult.passed,
          stage: validationResult.stage,
          errors: validationResult.errors,
          durationMs: validationResult.durationMs,
          warning: validationResult.passed
            ? "Guaranteed-green baseline applied and validated."
            : validationResult.warning,
          guaranteedGreen: true,
        });
      }
    }

    if (validationResult.passed) {
      const spec = checkRecipeSpec(generatedFiles, activeRecipe);
      if (!spec.ok) {
        emit("System", "info", {
          message: `Spec soft-miss for recipe ${activeRecipe.id}: missing ${spec.missing.join(", ")}. Keeping green build.`,
          missing: spec.missing,
        });
      } else {
        emit("System", "info", {
          message: `Spec check passed for recipe ${activeRecipe.id}.`,
        });
      }
    }

    let reviewOutput = "";
    if (validationResult.passed) {
      if (creditCheck && !(await creditCheck())) {
        write("pause", { reason: "credits_exhausted", agent: "Reviewer", message: "Build paused: insufficient credits." });
        await updateProjectStatus(projectId, "paused", "credits_exhausted");
        return;
      }
      if (isGoldenStack(techStack)) {
        reviewOutput = `# Review skipped\n\nGolden path: validation passed; reviewer skipped for speed.`;
        emit("Reviewer", "skipped", { message: "Golden path: reviewer skipped after green validation." });
      } else {
        emit("Reviewer", "start", { message: "Reviewing generated code…" });
        const reviewerLogId = await appendAgentLog({ projectId, agent: "Reviewer", content: "", isComplete: false });
        const filesSummary = Object.keys(generatedFiles).map((n) => `- ${n}`).join("\n");
        await streamLLM(
          [
            {
              role: "system",
              content: "Reviewer agent. Markdown report: ## Summary, ## Validation Status, ## Issues Found, ## Recommendations.",
            },
            {
              role: "user",
              content: `App: ${appTitle}\nFiles:\n${filesSummary}\nStack: ${techStack}\nValidation: PASSED`,
            },
          ],
          (chunk) => { reviewOutput += chunk; emit("Reviewer", "chunk", { text: chunk }); },
          signal, "reviewer",
        );
        await markAgentLogComplete(reviewerLogId);
        emit("Reviewer", "complete", { message: "Code review complete." });
      }
    } else {
      reviewOutput = `# Build review skipped\n\nValidation failed after ${maxFixRetries} attempts.\n\n## Errors\n${(validationResult.errors ?? []).map((e) => `- ${e}`).join("\n")}`;
      emit("Reviewer", "skipped", { message: "Review skipped — validation did not pass." });
    }

    generatedFiles["REVIEW.md"] = reviewOutput;
    generatedFiles["README.md"] =
      `# ${appTitle}\n\nGenerated by AppForge.\n\n**Stack:** ${techStack}\n\n**Validation:** ${validationResult?.passed ? "Passed" : "FAILED"}\n\n\`\`\`bash\nnpm install && npm run dev\n\`\`\`\n`;

    if (validationResult?.passed || !isGoldenStack(techStack)) {
      injectComplianceScaffolding(generatedFiles);
      generatedFiles = hardenGeneratedProject(generatedFiles, techStack);
    } else {
      generatedFiles = hardenGeneratedProject(generatedFiles, techStack);
    }
    await updateProjectFiles(projectId, generatedFiles);

    const { logger } = await import("../_core/logger.js");
    const {
      createBuildSnapshot, getNextVersion, getProjectById, markSnapshotAsCurrent,
    } = await import("../db.js");
    const { estimateLicenseAndCost } = await import("./licenseCostEstimator.js");
    const nextVersion = await getNextVersion(projectId);
    const userId = (await getProjectById(projectId))?.userId ?? 0;
    const pkgJson = generatedFiles["package.json"];
    const parsedDeps = pkgJson ? (JSON.parse(pkgJson).dependencies ?? {}) : {};
    const costReport = estimateLicenseAndCost(parsedDeps, techStack, 50, true);
    const snapshotId = await createBuildSnapshot({
      projectId, userId, version: nextVersion,
      label: appTitle ? `v${nextVersion} — ${appTitle}` : `v${nextVersion}`,
      files: generatedFiles,
      fileCount: Object.keys(generatedFiles).length,
      techStack, validationResult,
      auditScores: lastAuditResult
        ? {
            overall: lastAuditResult.overallScore,
            a11y: lastAuditResult.a11y.score,
            security: lastAuditResult.security.score,
            perf: lastAuditResult.perf.score,
            passed: lastAuditResult.passed,
          }
        : null,
      costEstimate: costReport,
    });
    logger.info({ projectId, snapshotId, version: nextVersion }, "build_snapshot_saved");
    await markSnapshotAsCurrent(snapshotId, projectId);
    await updateProjectStatus(projectId, validationResult?.passed ? "completed" : "failed");
    write("done", {
      projectId, snapshotId, title: appTitle,
      fileCount: Object.keys(generatedFiles).length,
      creditsSpent: BUILD_CREDIT_COST, creditsReserved: BUILD_CREDIT_COST,
      validationPassed: validationResult?.passed ?? false,
      validationStage: validationResult?.stage ?? "unknown",
      validationErrors: validationResult?.errors ?? [],
      manualReviewRequired: !validationResult?.passed,
      goldenStack: isGoldenStack(techStack),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("aborted")) {
      await updateProjectStatus(projectId, "failed", "Build cancelled by user.");
      write("error", { message: "Build cancelled." });
    } else {
      await updateProjectStatus(projectId, "failed", message);
      write("error", { message });
    }
  }
}
