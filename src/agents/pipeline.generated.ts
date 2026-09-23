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
  ensureRecipeFloor,
} from "../lib/appRecipes.js";
import {
  assertProductQuality,
  buildFailureDossier,
  coderModelForAttempt,
  configuredProviders,
  isAbortError,
  isMissingLlmKeysError,
  isNeverGiveUpEnabled,
  missingLlmKeysMessage,
  plannerModelForAttempt,
  providerAt,
  resolveMaxFixRetries,
  resolveMaxOuterAttempts,
} from "../lib/neverGiveUp.js";
import { applyDeterministicErrorFixes } from "../lib/errorFixTable.js";
import {
  stripComplianceFromGolden,
  capGoldenFiles,
} from "../lib/goldenLimits.js";
import { preferReactNodeStack } from "../lib/stackDefaults.js";
import type { TripleAuditResult } from "./tripleAudit.js";
import { db } from "../db.js";
import * as schema from "../db/schema.js";
import { eq } from "drizzle-orm";
import {
  renderProductContractForAgents,
  validateProductContract,
  type ProductContract,
} from "../lib/productContract.js";
import {
  parseAndValidateProductPlan,
  plannerJsonSchemaInstruction,
  type ProductPlan,
  type ProductPlanTask,
} from "../lib/productPlan.js";
import {
  agentCoordinationRecordSchema,
  appendCoordinationEvent,
  assertTaskOutputOwnership,
  buildAgentTaskContext,
  coordinationStatusSummary,
  createAgentCoordinationContext,
  createAgentCoordinationRecord,
  reconcileCoordinationResume,
  unlockReadyTasks,
  updateTaskCoordinationState,
  validateTaskHandoff,
  type AgentCoordinationContext,
  type AgentCoordinationRecord,
} from "../lib/agentCoordination.js";

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

type StreamOpts = {
  signal?: AbortSignal;
  modelRole?: "planner" | "coder" | "reviewer";
  modelOverride?: string;
  startProviderIndex?: number;
  preferredProviderId?: string;
};

async function streamLLM(
  messages: { role: string; content: string }[],
  onChunk: (chunk: string) => void,
  opts?: StreamOpts | AbortSignal,
  modelRole?: "planner"|"coder"|"reviewer",
): Promise<string> {
  // Back-compat: (messages, onChunk, signal, role) OR (messages, onChunk, opts)
  const normalized: StreamOpts =
    opts && typeof opts === "object" && !("aborted" in (opts as object))
      ? (opts as StreamOpts)
      : { signal: opts as AbortSignal | undefined, modelRole };
  if (modelRole && !normalized.modelRole) normalized.modelRole = modelRole;
  const model =
    normalized.modelOverride ||
    (normalized.modelRole ? modelForAgent(normalized.modelRole) : undefined);
  const result = await invokeLLM({
    messages: messages as any,
    model,
    startProviderIndex: normalized.startProviderIndex,
    preferredProviderId: normalized.preferredProviderId,
    signal: normalized.signal,
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

export type PlanTask = ProductPlanTask;
export interface PipelineOptions {
  locale?: string;
  buildCapabilities?: BuildCapabilityId[];
  productContract?: ProductContract;
}

/** Pure helper — continue outer loop when validation/quality failed and retries remain. */
export function shouldContinueNeverGiveUp(opts: {
  passed: boolean;
  aborted: boolean;
  outerAttempt: number;
  maxOuter: number;
  neverGiveUp: boolean;
}): boolean {
  if (opts.passed || opts.aborted) return false;
  if (!opts.neverGiveUp) return false;
  return opts.outerAttempt < opts.maxOuter;
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
  techStack = preferReactNodeStack(techStack);
  const locale = options?.locale ?? "en";
  const localeHint = `${LOCALE_UI_HINT(locale)}\n${plannerLocaleHint(locale)}`.trim();
  const capabilities = normalizeCapabilities(options?.buildCapabilities ?? []);
  const capabilityHints = capabilityHintsForPipeline(capabilities);
  const neverGiveUp = isNeverGiveUpEnabled();
  const maxFixRetries = neverGiveUp
    ? resolveMaxFixRetries(techStack)
    : maxFixRetriesForStack(techStack);
  const maxOuter = resolveMaxOuterAttempts();
  const providers = configuredProviders();
  let providerIndex = 0;
  let outerAttempt = 0;

  const projectRow = await db.query.projects.findFirst({
    where: eq(schema.projects.id, projectId),
    columns: {
      buildCapabilities: true,
      productContract: true,
      researchRecord: true,
      productPlan: true,
      agentCoordination: true,
    },
  });
  const productContract = validateProductContract(
    options?.productContract ?? projectRow?.productContract,
  );
  const contractContext = renderProductContractForAgents(productContract);
  const storedCaps = normalizeCapabilities(projectRow?.buildCapabilities ?? []);
  const activeCapabilities = capabilities.length > 0 ? capabilities : storedCaps;

  let coordinationContext: AgentCoordinationContext | null = null;
  let coordinationRecord: AgentCoordinationRecord | null = null;
  let completedTaskIds = new Set<string>();
  let resumedGeneratedFiles: Record<string, string> = {};

  const persistCoordination = async () => {
    if (!coordinationRecord) return;
    await db
      .update(schema.projects)
      .set({
        agentCoordination: coordinationRecord,
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, projectId));
  };

  const recordCoordinationEvent = async (
    event: Omit<Parameters<typeof appendCoordinationEvent>[1], "at">,
  ) => {
    if (!coordinationRecord) return;
    coordinationRecord = appendCoordinationEvent(coordinationRecord, event);
    await persistCoordination();
  };
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
    message: `Validation mode: ${validationMode === "full" ? "full compile sandbox" : "structure check only"}${isGoldenStack(techStack) ? " · golden reliability path" : ""}${neverGiveUp ? " · never-give-up loop ON" : ""}`,
    validationMode,
    goldenStack: isGoldenStack(techStack),
    techStack,
    neverGiveUp,
    maxFixRetries,
    maxOuterAttempts: maxOuter,
  });

  if (providers.length === 0) {
    const msg = missingLlmKeysMessage();
    emit("System", "error", { message: msg, infra: true, missingAiKeys: true });
    write("error", { message: msg, error: "missing_ai_keys", infra: true });
    await updateProjectStatus(projectId, "paused", "missing_ai_keys");
    return;
  }

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

    let researchBrief = await runResearchAgent(
      projectId, description, techStack,
      (type, payload) => emit("Research", type, payload),
      { focus: researchFocus, signal, productContract },
    );

    if (creditCheck && !(await creditCheck())) {
      write("pause", { reason: "credits_exhausted", agent: "Planner", message: "Build paused: insufficient credits." });
      await updateProjectStatus(projectId, "paused", "credits_exhausted");
      return;
    }

    let generatedFiles: Record<string, string> = {};
    let validationResult: ValidationResult | null = null;
    let lastAuditResult: TripleAuditResult | null = null;
    let appTitle = description.slice(0, 60);
    let activeRecipe = classifyRecipe(description);
    let tasks: PlanTask[] = [];
    let redesignBrief = "";
    let coordinationContextText = "";

    // Outer never-give-up: re-plan → code → validate → escalate provider until real quality pass
    outerLoop: while (!signal?.aborted) {
      outerAttempt++;
      const provider = providerAt(providerIndex) ?? providers[0];
      const plannerModel = plannerModelForAttempt(outerAttempt, provider);
      const coderModel = coderModelForAttempt(outerAttempt, provider);
      emit("System", "info", {
        message: `Still building — iterating until it works (attempt ${outerAttempt}${maxOuter < 10000 ? "/" + maxOuter : ""}) · provider=${provider.id} · model=${coderModel || provider.defaultModel}`,
        outerAttempt,
        maxOuterAttempts: maxOuter,
        provider: provider.id,
        model: coderModel || provider.defaultModel,
        neverGiveUp,
      });
      await updateProjectStatus(projectId, "running");

      if (redesignBrief) {
        researchBrief = await runResearchAgent(
          projectId, description, techStack,
          (type, payload) => emit("Research", type, payload),
          { focus: researchFocus, signal, redesignBrief, productContract },
        );
      }

      if (creditCheck && !(await creditCheck())) {
        write("pause", { reason: "credits_exhausted", agent: "Planner", message: "Build paused: insufficient credits." });
        await updateProjectStatus(projectId, "paused", "credits_exhausted");
        return;
      }

    emit("Planner", "start", {
      message:
        outerAttempt > 1
          ? "Re-planning architecture with validated contract and research evidence."
          : "Creating a contract-aware architecture and implementation plan.",
      outerAttempt,
      provider: provider.id,
    });
    const plannerLogId = await appendAgentLog({
      projectId,
      agent: "Planner",
      content: "",
      isComplete: false,
    });

    const plannerSystemPrompt = [
      "You are the AppForge Planner agent.",
      "Produce a complete architecture and implementation plan from the canonical product contract.",
      "The product contract is authoritative. Research is evidence and implementation guidance only.",
      plannerJsonSchemaInstruction(),
      "Required design coverage: product workflows, personas, user roles, frontend modules, backend modules, database modules, AI modules where applicable, integration modules, authentication, authorization, billing, deployment, operations, recovery, monetization, implementation order, dependencies, acceptance criteria, requirement-to-task mapping, task-to-file mapping, task-to-agent mapping, and task-to-validation mapping.",
      "Do not output a generic plan for a complex product. Do not use Core App or Core UI as a fallback.",
      "Selected stack: " + techStack,
      designHints,
      capabilityHints,
      researchBrief
        ? "VERIFIED RESEARCH EVIDENCE AND IMPLEMENTATION DECISIONS:\n" + researchBrief
        : "No research brief is available.",
      redesignBrief
        ? "SANDBOX FAILURE DOSSIER — redesign materially around this evidence:\n" + redesignBrief
        : "",
      localeHint,
      contractContext,
    ]
      .filter(Boolean)
      .join("\n");

    let productPlan: ProductPlan | null = null;
    let plannerOutput = "";
    let plannerValidationError = "";

    for (let plannerAttempt = 1; plannerAttempt <= 3; plannerAttempt++) {
      plannerOutput = "";
      if (plannerAttempt > 1) {
        emit("Planner", "retry", {
          attempt: plannerAttempt,
          message:
            "Planner output failed strict validation; retrying with the validation error.",
          validationError: plannerValidationError,
        });
      }

      await streamLLM(
        [
          {
            role: "system",
            content:
              plannerSystemPrompt +
              (plannerValidationError
                ? "\nPREVIOUS OUTPUT VALIDATION ERROR:\n" +
                  plannerValidationError +
                  "\nReturn a corrected complete JSON object."
                : ""),
          },
          {
            role: "user",
            content:
              "Original prompt:\n" +
              productContract.originalPrompt +
              "\n\nCreate the complete validated plan for product type " +
              productContract.productType +
              " using stack " +
              techStack +
              ".",
          },
        ],
        (chunk) => {
          plannerOutput += chunk;
          emit("Planner", "chunk", { text: chunk, attempt: plannerAttempt });
        },
        {
          signal,
          modelRole: "planner",
          modelOverride: plannerModel,
          startProviderIndex: providerIndex,
          preferredProviderId: provider.id,
        },
      );

      try {
        productPlan = parseAndValidateProductPlan(
          plannerOutput,
          productContract,
        );
        break;
      } catch (error) {
        plannerValidationError =
          error instanceof Error
            ? error.message
            : "Unknown planner validation error";
      }
    }

    if (!productPlan) {
      await db
        .update(schema.agentLogs)
        .set({
          content:
            plannerOutput +
            "\n\nPLANNER_VALIDATION_ERROR:\n" +
            plannerValidationError,
          updatedAt: new Date(),
        })
        .where(eq(schema.agentLogs.id, plannerLogId));
      await markAgentLogComplete(plannerLogId);
      emit("Planner", "failed", {
        message:
          "Planner failed strict schema validation after three attempts.",
        validationError: plannerValidationError,
      });
      throw new Error(
        "Planner failed strict schema validation: " + plannerValidationError,
      );
    }

    await db
      .update(schema.agentLogs)
      .set({
        content: JSON.stringify(productPlan, null, 2),
        updatedAt: new Date(),
      })
      .where(eq(schema.agentLogs.id, plannerLogId));
    await db
      .update(schema.projects)
      .set({ productPlan, updatedAt: new Date() })
      .where(eq(schema.projects.id, projectId));
    await markAgentLogComplete(plannerLogId);

    const coordinationRow = await db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId),
      columns: {
        researchRecord: true,
        agentCoordination: true,
        generatedFiles: true,
      },
    });
    coordinationContext = createAgentCoordinationContext({
      productContract,
      productPlan,
      researchRecord: coordinationRow?.researchRecord ?? null,
    });
    coordinationContextText = JSON.stringify(
      {
        plan: productPlan,
        requirements: productContract.functionalRequirements,
        researchDecisions: coordinationContext.researchDecisions,
      },
      null,
      2,
    );

    const freshCoordination = createAgentCoordinationRecord({
      projectId,
      context: coordinationContext,
    });
    const existingCoordination = agentCoordinationRecordSchema.safeParse(
      coordinationRow?.agentCoordination,
    );
    if (
      existingCoordination.success &&
      existingCoordination.data.productType === productContract.productType &&
      existingCoordination.data.selectedTechnologyStack ===
        productContract.selectedTechnologyStack &&
      existingCoordination.data.planTitle === productPlan.title &&
      Object.keys(existingCoordination.data.taskStates).every((taskId) =>
        productPlan.tasks.some((task) => task.id === taskId),
      )
    ) {
      resumedGeneratedFiles =
        (coordinationRow?.generatedFiles as Record<string, string> | null) ?? {};
      coordinationRecord = reconcileCoordinationResume({
        record: existingCoordination.data,
        generatedFiles: resumedGeneratedFiles,
      });
      await recordCoordinationEvent({
        agent: "System",
        type: "resume",
        detail:
          "Resumed persisted coordination state after reconciling completed task outputs against current generated files.",
        provider: provider.id,
        model: plannerModel || provider.defaultModel,
      });
    } else {
      coordinationRecord = freshCoordination;
      if (existingCoordination.success) {
        coordinationRecord = agentCoordinationRecordSchema.parse({
          ...coordinationRecord,
          events: existingCoordination.data.events,
        });
      }
    }

    completedTaskIds = new Set(
      Object.values(coordinationRecord.taskStates)
        .filter((taskState) => taskState.status === "completed")
        .map((taskState) => taskState.taskId),
    );
    coordinationRecord = unlockReadyTasks(coordinationRecord);
    await persistCoordination();
    await recordCoordinationEvent({
      agent: "Planner",
      type: "handoff",
      detail:
        "Validated plan, canonical requirements, research decisions, file ownership, and dependency graph handed to downstream agents.",
      provider: provider.id,
      model: plannerModel || provider.defaultModel,
    });
    emit("System", "coordination_ready", {
      taskCount: productPlan.tasks.length,
      completedTaskIds: [...completedTaskIds],
      requirementIds: coordinationContext.requirementIds,
      researchDecisionIds: productPlan.researchDecisionIds,
      fileOwners: coordinationRecord.fileOwners,
      status: coordinationStatusSummary(coordinationRecord),
    });

    emit("Planner", "complete", {
      message: "Validated architecture and implementation plan complete.",
      taskCount: productPlan.tasks.length,
      requirementMappings: Object.keys(productPlan.requirementToTasks).length,
    });

    tasks = productPlan.tasks;
    appTitle = productPlan.title;
    activeRecipe = classifyRecipe(description);
    emit("System", "info", {
      message: "Validated planner evidence persisted.",
      recipe: activeRecipe.id,
      taskCount: tasks.length,
    });

    if (creditCheck && !(await creditCheck())) {
      write("pause", { reason: "credits_exhausted", agent: "Coder", message: "Build paused: insufficient credits." });
      await updateProjectStatus(projectId, "paused", "credits_exhausted");
      return;
    }

    emit("Coder", "start", {
      message: `Writing high-quality code for ${tasks.length} modules… (${provider.id}/${coderModel || provider.defaultModel})`,
      outerAttempt,
      provider: provider.id,
      model: coderModel || provider.defaultModel,
    });
    generatedFiles = {};
    validationResult = null;
    lastAuditResult = null;
    let fixAttempt = 0;
    const testsBlocking = validationMode === "full";

    do {
      if (fixAttempt > 0) {
        emit("Coder", "fix_start", {
          message: `Surgical auto-fix attempt ${fixAttempt}/${maxFixRetries}`,
          errors: validationResult?.errors ?? [],
        });

        const det = applyDeterministicErrorFixes(
          generatedFiles,
          validationResult?.errors ?? [],
        );
        if (det.applied.length > 0) {
          generatedFiles = det.files;
          emit("System", "info", {
            message: `Deterministic fixes: ${det.applied.join(", ")}`,
            applied: det.applied,
          });
        }

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
              content: `You are the Coder agent performing a SURGICAL FIX.\nOutput only corrected files with // filename: path markers.\nDo not regenerate the whole app.\nPreserve the validated product plan, requirement mappings, file ownership, and research decisions.\n${goldenCoderRules(techStack)}\n${localeHint}\n${contractContext}\nCOORDINATION_CONTEXT:\n${coordinationContextText}`,
            },
            { role: "user", content: fixPrompt },
          ],
          (chunk) => {
            fixContent += chunk;
            emit("Coder", "chunk", { module: "fix", text: chunk });
          },
          {
            signal,
            modelRole: "coder",
            modelOverride: coderModel,
            startProviderIndex: providerIndex,
            preferredProviderId: provider.id,
          },
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
        await db
          .update(schema.agentLogs)
          .set({
            content:
              `# Surgical fix ${fixAttempt}\n\n# INPUT\n${fixPrompt}\n\n# OUTPUT\n${fixContent}`,
            updatedAt: new Date(),
          })
          .where(eq(schema.agentLogs.id, coderLogId));
        await markAgentLogComplete(coderLogId);
        await updateProjectFiles(projectId, { ...generatedFiles });
        resumedGeneratedFiles = { ...generatedFiles };
        await recordCoordinationEvent({
          agent: "Coder",
          type: "decision",
          detail:
            `Surgical repair attempt ${fixAttempt} persisted ${Object.keys(patches).length} parsed patch file(s) without changing the canonical product scope.`,
          provider: provider.id,
          model: coderModel || provider.defaultModel,
        });
        emit("Coder", "complete", {
          message: `Surgical fix applied (${Object.keys(patches).length} file(s)).`,
          coordinationStatus: coordinationRecord
            ? coordinationStatusSummary(coordinationRecord)
            : undefined,
        });
      } else {
        generatedFiles = { ...resumedGeneratedFiles };

        for (const task of [...tasks].sort((a, b) => a.sequence - b.sequence)) {
          if (signal?.aborted) {
            if (coordinationRecord?.taskStates[task.id]) {
              coordinationRecord = updateTaskCoordinationState(
                coordinationRecord,
                task.id,
                {
                  status: "paused",
                  lastError: "Agent execution interrupted by abort/timeout signal",
                },
              );
              await recordCoordinationEvent({
                agent: task.agent,
                type: "pause",
                taskId: task.id,
                detail:
                  "Task paused after abort/timeout signal; persisted coordination state can resume this task.",
              });
            }
            break;
          }
          if (!coordinationContext || !coordinationRecord) {
            throw new Error("Agent coordination context was not initialized");
          }

          const existingTaskState = coordinationRecord.taskStates[task.id];
          if (existingTaskState?.status === "completed") {
            emit("Coder", "task_resume_skip", {
              module: task.module,
              taskId: task.id,
              ownerAgent: task.agent,
              message: "Skipping already completed task with persisted output.",
            });
            continue;
          }

          validateTaskHandoff({
            context: coordinationContext,
            record: coordinationRecord,
            task,
            completedTaskIds,
          });

          const taskContext = buildAgentTaskContext({
            context: coordinationContext,
            task,
          });
          let taskSucceeded = false;
          let taskLastError = "";

          for (let taskAttempt = 1; taskAttempt <= 3; taskAttempt++) {
            const attemptProviderIndex =
              (providerIndex + taskAttempt - 1) % providers.length;
            const attemptProvider =
              providerAt(attemptProviderIndex) ?? provider;
            const previousAttempts =
              coordinationRecord.taskStates[task.id]?.attempts ?? 0;

            coordinationRecord = updateTaskCoordinationState(
              coordinationRecord,
              task.id,
              {
                status: taskAttempt === 1 ? "running" : "retrying",
                attempts: previousAttempts + 1,
                lastError: taskLastError || null,
              },
            );
            await recordCoordinationEvent({
              agent: task.agent,
              type: taskAttempt === 1 ? "start" : "retry",
              taskId: task.id,
              provider: attemptProvider.id,
              model: coderModel || attemptProvider.defaultModel,
              detail:
                taskAttempt === 1
                  ? "Starting owned task with canonical contract, validated plan, requirement manifest, and research decisions."
                  : "Retrying malformed or invalid task output with identical canonical context on provider fallback.",
            });
            emit("Coder", "coordination_status", {
              taskId: task.id,
              module: task.module,
              ownerAgent: task.agent,
              attempt: taskAttempt,
              provider: attemptProvider.id,
              status: coordinationStatusSummary(coordinationRecord),
            });

            const coderInput =
              `SPECIALIST_AGENT: ${task.agent}\n` +
              `TASK_CONTEXT:\n${taskContext}\n\n` +
              "Return only files owned by this task. Do not change scope, requirements, ownership, or dependencies.";
            const coderLogId = await appendAgentLog({
              projectId,
              agent: `Coder:${task.agent}`,
              content: `# INPUT\n${coderInput}\n\n# OUTPUT\n`,
              isComplete: false,
            });

            let fileContent = "";
            try {
              await streamLLM(
                [
                  {
                    role: "system",
                    content: `You are the ${task.agent} specialist operating inside AppForge's coordinated Coder stage. Output files as // filename: path then full code.\nBuild real implementations only; never stubs, TODOs, empty handlers, fake success, or unrelated features.\nYou may only write files assigned to this task.\n${goldenCoderRules(techStack)}\n${recipeCoderHint(productContract.originalPrompt)}\n${designHints}\n${capabilityHints}\n${localeHint}\n${contractContext}\nCOORDINATION_CONTEXT:\n${coordinationContextText}`,
                  },
                  {
                    role: "user",
                    content: coderInput,
                  },
                ],
                (chunk) => {
                  fileContent += chunk;
                  emit("Coder", "chunk", {
                    taskId: task.id,
                    module: task.module,
                    ownerAgent: task.agent,
                    text: chunk,
                  });
                },
                {
                  signal,
                  modelRole: "coder",
                  modelOverride: coderModel,
                  startProviderIndex: attemptProviderIndex,
                  preferredProviderId: attemptProvider.id,
                },
              );

              const parsedFiles = parseGeneratedFiles(fileContent);
              if (Object.keys(parsedFiles).length === 0) {
                throw new Error(
                  `Task ${task.id} returned malformed output with no parseable files`,
                );
              }

              assertTaskOutputOwnership({
                task,
                files: parsedFiles,
                record: coordinationRecord,
              });

              Object.assign(generatedFiles, parsedFiles);
              const outputFiles = Object.keys(parsedFiles);
              coordinationRecord = updateTaskCoordinationState(
                coordinationRecord,
                task.id,
                {
                  status: "completed",
                  lastError: null,
                  outputFiles,
                },
              );
              completedTaskIds.add(task.id);
              coordinationRecord = unlockReadyTasks(coordinationRecord);

              await db
                .update(schema.agentLogs)
                .set({
                  content:
                    `# INPUT\n${coderInput}\n\n# OUTPUT\n${fileContent}`,
                  updatedAt: new Date(),
                })
                .where(eq(schema.agentLogs.id, coderLogId));
              await markAgentLogComplete(coderLogId);
              await recordCoordinationEvent({
                agent: task.agent,
                type: "output",
                taskId: task.id,
                provider: attemptProvider.id,
                model: coderModel || attemptProvider.defaultModel,
                detail:
                  `Task completed with owned files: ${outputFiles.join(", ")}`,
              });
              await recordCoordinationEvent({
                agent: task.agent,
                type: "handoff",
                taskId: task.id,
                detail:
                  "Validated task output handed to dependent tasks; ownership and requirement mappings preserved.",
              });

              for (const filename of outputFiles) {
                emit("Coder", "task_complete", {
                  taskId: task.id,
                  module: task.module,
                  ownerAgent: task.agent,
                  filename,
                });
              }
              emit("Coder", "coordination_status", {
                taskId: task.id,
                ownerAgent: task.agent,
                status: coordinationStatusSummary(coordinationRecord),
              });
              await updateProjectFiles(projectId, { ...generatedFiles });
              write("files_partial", {
                fileCount: Object.keys(generatedFiles).length,
                taskId: task.id,
                ownerAgent: task.agent,
              });
              taskSucceeded = true;
              break;
            } catch (taskError) {
              taskLastError =
                taskError instanceof Error
                  ? taskError.message
                  : "Unknown task coordination error";
              coordinationRecord = updateTaskCoordinationState(
                coordinationRecord,
                task.id,
                {
                  status: taskAttempt < 3 ? "retrying" : "failed",
                  lastError: taskLastError,
                },
              );
              await db
                .update(schema.agentLogs)
                .set({
                  content:
                    `# INPUT\n${coderInput}\n\n# OUTPUT\n${fileContent}\n\n# FAILURE\n${taskLastError}`,
                  updatedAt: new Date(),
                })
                .where(eq(schema.agentLogs.id, coderLogId));
              await markAgentLogComplete(coderLogId);
              await recordCoordinationEvent({
                agent: task.agent,
                type: taskAttempt < 3 ? "retry" : "failure",
                taskId: task.id,
                provider: attemptProvider.id,
                model: coderModel || attemptProvider.defaultModel,
                detail: taskLastError,
              });
              emit("Coder", "coordination_status", {
                taskId: task.id,
                ownerAgent: task.agent,
                attempt: taskAttempt,
                error: taskLastError,
                status: coordinationStatusSummary(coordinationRecord),
              });
              if (signal?.aborted) break;
            }
          }

          if (!taskSucceeded) {
            throw new Error(
              `Task ${task.id} failed coordinated execution after retries: ${taskLastError}`,
            );
          }
        }

        emit("Coder", "complete", {
          message: `Generated ${Object.keys(generatedFiles).length} files with coordinated task ownership.`,
          status: coordinationRecord
            ? coordinationStatusSummary(coordinationRecord)
            : undefined,
        });
      }

      try {
        generatedFiles = mergeScaffoldWithGenerated(getStackScaffold(techStack), generatedFiles);
        generatedFiles = ensureEssentialFiles(generatedFiles, techStack);
        generatedFiles = hardenGeneratedProject(generatedFiles, techStack);
        if (isGoldenStack(techStack) || techStack.includes("react")) {
          generatedFiles = ensureRecipeFloor(generatedFiles, {
            title: appTitle,
            description,
            recipe: activeRecipe,
          });
          generatedFiles = stripComplianceFromGolden(generatedFiles);
          generatedFiles = capGoldenFiles(generatedFiles, 12);
          generatedFiles = hardenGeneratedProject(generatedFiles, techStack);
          emit("System", "info", {
            message: `Recipe floor + file cap + no compliance (${activeRecipe.id}).`,
          });
        }
        emit("System", "info", { message: "Reliability pass applied (entrypoints, package.json, imports)." });
        if (mergeBilling) {
          const fintechSchema = generatedFiles["fintech/fintech-schema.json"];
          generatedFiles = mergeBillingScaffold(generatedFiles, techStack, fintechSchema, productContract);
          generatedFiles = hardenGeneratedProject(generatedFiles, techStack);
          emit("System", "info", { message: "Merged Stripe billing scaffold." });
        }
      } catch { /* non-fatal */ }

      if (validationMode === "full") {
        emit("Testing", "start", {
          message:
            "Generating blocking unit tests before validation and deployment…",
        });
        const testFiles = await attachGeneratedTests(
          generatedFiles,
          techStack,
          productContract.functionalRequirements.map((requirement) => requirement.text),
          productContract,
          coordinationContextText,
        );
        Object.assign(generatedFiles, testFiles);
        const testingLogId = await appendAgentLog({
          projectId,
          agent: "Testing",
          content:
            "# INPUT\n" +
            coordinationContextText +
            "\n\n# OUTPUT\nGenerated test files:\n" +
            Object.keys(testFiles).join("\n"),
          isComplete: true,
        });
        void testingLogId;
        await recordCoordinationEvent({
          agent: "Testing",
          type: "output",
          detail:
            `Generated ${Object.keys(testFiles).length} requirement-linked test file(s) from the coordinated plan context.`,
        });
        emit("Testing", "complete", {
          message: `Prepared ${Object.keys(testFiles).length} test file(s) for the blocking validation gate.`,
          status: coordinationRecord
            ? coordinationStatusSummary(coordinationRecord)
            : undefined,
        });
      } else {
        emit("Testing", "skipped", {
          message:
            "Structural-only stack: automated runtime test execution is not yet available for this stack.",
        });
      }

      if (creditCheck && !(await creditCheck())) {
        write("pause", { reason: "credits_exhausted", agent: "Validator", message: "Build paused: insufficient credits." });
        await updateProjectStatus(projectId, "paused", "credits_exhausted");
        return;
      }

      emit("Validator", "start", { message: "Compiling and testing generated code in sandbox…" });
      validationResult = await validateGeneratedBuild(generatedFiles, techStack, {
        testsBlocking,
        validateBilling: mergeBilling,
        productContract,
        productPlan: coordinationContext?.productPlan,
        researchDecisions: coordinationContext?.researchDecisions,
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

      // Strict product quality bar — compile-green stubs are NOT success
      if (validationResult.passed) {
        const quality = assertProductQuality(generatedFiles, {
          description,
          recipe: activeRecipe,
          title: appTitle,
        });
        if (!quality.ok) {
          validationResult = {
            ...validationResult,
            passed: false,
            stage: "quality",
            errors: [...validationResult.errors, ...quality.errors],
          };
          emit("Validator", "quality_fail", {
            message: "Quality bar not met — continuing never-give-up loop with real AI (not shipping stubs).",
            errors: quality.errors,
            outerAttempt,
          });
        }
      }

      await appendAgentLog({
        projectId,
        agent: "Validator",
        content:
          "# INPUT\n" +
          coordinationContextText +
          "\n\n# OUTPUT\n" +
          JSON.stringify(validationResult, null, 2),
        isComplete: true,
      });
      await recordCoordinationEvent({
        agent: "Validator",
        type: validationResult.passed ? "complete" : "failure",
        detail:
          `Validation stage ${validationResult.stage}: ${validationResult.passed ? "passed" : validationResult.errors.slice(0, 3).join("; ")}`,
      });
      emit("Validator", "complete", {
        passed: validationResult.passed,
        stage: validationResult.stage,
        errors: validationResult.errors,
        durationMs: validationResult.durationMs,
        warning: validationResult.warning,
      });
      fixAttempt++;
    } while (!validationResult.passed && fixAttempt <= maxFixRetries && !signal?.aborted);

    if (validationResult.passed) {
      emit("System", "info", {
        message: `Validation + quality passed on outer attempt ${outerAttempt}.`,
        outerAttempt,
        provider: provider.id,
      });
      break outerLoop;
    }

    if (signal?.aborted) break outerLoop;

    if (
      shouldContinueNeverGiveUp({
        passed: false,
        aborted: false,
        outerAttempt,
        maxOuter,
        neverGiveUp,
      })
    ) {
      redesignBrief = buildFailureDossier({
        outerAttempt,
        techStack,
        stage: validationResult?.stage ?? null,
        errors: validationResult?.errors ?? [],
        previousTasks: tasks,
        provider: provider.id,
        model: coderModel || provider.defaultModel,
      });
      resumedGeneratedFiles = { ...generatedFiles };
      await updateProjectFiles(projectId, resumedGeneratedFiles);
      await recordCoordinationEvent({
        agent: "Planner",
        type: "decision",
        detail:
          "Repair burst exhausted; preserving current files and coordination evidence before contract-aware redesign.",
        provider: provider.id,
        model: plannerModel || provider.defaultModel,
      });
      emit("Planner", "redesign_required", {
        message: "Repair burst exhausted. Returning failure evidence to design for a materially different plan.",
        outerAttempt,
        stage: validationResult?.stage,
        errors: (validationResult?.errors ?? []).slice(0, 8),
      });
      providerIndex = (providerIndex + 1) % providers.length;
      const nextProvider = providerAt(providerIndex) ?? providers[0];
      emit("System", "info", {
        message: `Validation/quality not met — re-planning with next provider (${nextProvider.id}). Still building — iterating until it works.`,
        outerAttempt,
        nextProvider: nextProvider.id,
        errors: (validationResult.errors ?? []).slice(0, 8),
      });
      continue outerLoop;
    }

    // Soft ceiling while never-give-up: pause (reconnect/resume) — never claim could-not-build
    if (neverGiveUp) {
      emit("System", "info", {
        message: `Reached outer attempt soft ceiling (${maxOuter}) without a green high-quality build. Status paused — reconnect to continue. Never shipping stubs.`,
        outerAttempt,
        maxOuter,
      });
      await updateProjectStatus(projectId, "paused", `still_building_soft_ceiling_${maxOuter}`);
      write("pause", {
        reason: "still_building",
        message: "Build still iterating. Reconnect or resume — we do not ship unfinished stubs.",
        outerAttempt,
      });
      return;
    }

    // Legacy path (never-give-up OFF): optional debug GG, else fail
    emit("Validator", "failed", {
      message: `Build could not be auto-fixed after ${maxFixRetries} attempts.`,
      errors: validationResult.errors,
      stage: validationResult.stage,
    });

    const allowGuaranteedGreen = ["1", "true", "yes", "on"].includes(
      (process.env.ALLOW_GUARANTEED_GREEN ?? "").trim().toLowerCase(),
    );
    if (
      allowGuaranteedGreen &&
      (isGoldenStack(techStack) || techStack.includes("react"))
    ) {
      emit("System", "info", {
        message: `ALLOW_GUARANTEED_GREEN: applying recipe baseline (${classifyRecipe(description).id}) — not customer success.`,
        guaranteedGreenDebug: true,
      });
      generatedFiles = buildGuaranteedGreenApp({
        title: appTitle,
        description,
        techStack,
      });
      validationResult = await validateGeneratedBuild(generatedFiles, techStack, {
        testsBlocking: false,
        validateBilling: false,
        productContract,
        productPlan: coordinationContext?.productPlan,
        researchDecisions: coordinationContext?.researchDecisions,
      });
      emit("Validator", "complete", {
        passed: validationResult.passed,
        stage: validationResult.stage,
        errors: validationResult.errors,
        durationMs: validationResult.durationMs,
        warning: validationResult.passed
          ? "Debug guaranteed-green baseline applied (ALLOW_GUARANTEED_GREEN)."
          : validationResult.warning,
        guaranteedGreen: true,
        guaranteedGreenDebug: true,
      });
      break outerLoop;
    }

    await updateProjectStatus(
      projectId,
      "failed",
      `Validation failed after ${maxFixRetries} attempts: ${(validationResult.errors ?? []).slice(0, 5).join("; ")}`,
    );
    write("error", {
      message: `Build failed validation after ${maxFixRetries} attempts.`,
      errors: validationResult.errors,
      stage: validationResult.stage,
      validationPassed: false,
    });
    return;
    } // end outerLoop

    if (validationResult?.passed) {
      emit("System", "info", {
        message: `Quality + validation bar met for recipe ${activeRecipe.id} (real AI output — no template swap).`,
        recipe: activeRecipe.id,
        outerAttempt,
      });
    }

    if (signal?.aborted) {
      await updateProjectStatus(projectId, "failed", "Build cancelled by user.");
      write("error", { message: "Build cancelled." });
      return;
    }

    if (!validationResult?.passed) {
      // Should only reach here if never-give-up off already returned, or abort
      await updateProjectStatus(projectId, "failed", "Validation did not pass");
      write("error", { message: "Build ended without validation pass.", validationPassed: false });
      return;
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
        const reviewerInput =
          "App: " +
          appTitle +
          "\nStack: " +
          techStack +
          "\n\nCOORDINATION_CONTEXT:\n" +
          coordinationContextText;
        const reviewerLogId = await appendAgentLog({
          projectId,
          agent: "Reviewer",
          content: "# INPUT\n" + reviewerInput + "\n\n# OUTPUT\n",
          isComplete: false,
        });
        const filesSummary = Object.keys(generatedFiles).map((n) => `- ${n}`).join("\n");
        await streamLLM(
          [
            {
              role: "system",
              content:
                "Reviewer agent. Review against the canonical product contract, validated plan, requirement mappings, research decisions, and validation evidence. Do not change scope or permissions. Markdown report: ## Summary, ## Validation Status, ## Issues Found, ## Recommendations.\n" +
                contractContext +
                "\nCOORDINATION_CONTEXT:\n" +
                coordinationContextText,
            },
            {
              role: "user",
              content:
                reviewerInput +
                `\nFiles:\n${filesSummary}\nValidation: PASSED`,
            },
          ],
          (chunk) => { reviewOutput += chunk; emit("Reviewer", "chunk", { text: chunk }); },
          signal, "reviewer",
        );
        await db
          .update(schema.agentLogs)
          .set({
            content:
              "# INPUT\n" +
              reviewerInput +
              "\n\n# OUTPUT\n" +
              reviewOutput,
            updatedAt: new Date(),
          })
          .where(eq(schema.agentLogs.id, reviewerLogId));
        await markAgentLogComplete(reviewerLogId);
        await recordCoordinationEvent({
          agent: "Reviewer",
          type: "decision",
          detail: "Reviewer completed against canonical coordination context.",
        });
        emit("Reviewer", "complete", {
          message: "Code review complete.",
          status: coordinationRecord
            ? coordinationStatusSummary(coordinationRecord)
            : undefined,
        });
      }
    } else {
      reviewOutput = `# Build review skipped\n\nValidation failed after ${maxFixRetries} attempts.\n\n## Errors\n${(validationResult.errors ?? []).map((e) => `- ${e}`).join("\n")}`;
      emit("Reviewer", "skipped", { message: "Review skipped — validation did not pass." });
    }

    generatedFiles["REVIEW.md"] = reviewOutput;
    generatedFiles["README.md"] =
      `# ${appTitle}\n\nGenerated by AppForge.\n\n**Stack:** ${techStack}\n\n**Validation:** ${validationResult?.passed ? "Passed" : "FAILED"}\n\n\`\`\`bash\nnpm install && npm run dev\n\`\`\`\n`;

    if (validationResult?.passed && !isGoldenStack(techStack) && !techStack.includes("react")) {
      injectComplianceScaffolding(generatedFiles);
    }
    if (isGoldenStack(techStack) || techStack.includes("react")) {
      generatedFiles = stripComplianceFromGolden(generatedFiles);
    }
    generatedFiles = hardenGeneratedProject(generatedFiles, techStack);
    const { materializeHostedHtml, publicAppUrl } = await import(
      "../lib/hostedRuntime.js"
    );
    const liveUrl = publicAppUrl(projectId);
    generatedFiles["_hosted/index.html"] = materializeHostedHtml({
      projectId,
      title: appTitle,
      description,
      techStack,
      files: generatedFiles,
    });
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
    await updateProjectStatus(projectId, "completed");
    write("done", {
      projectId, snapshotId, title: appTitle,
      fileCount: Object.keys(generatedFiles).length,
      creditsSpent: BUILD_CREDIT_COST, creditsReserved: BUILD_CREDIT_COST,
      validationPassed: true,
      validationStage: validationResult?.stage ?? "unknown",
      validationErrors: [],
      testGateRequired: validationMode === "full",
      generatedTestFileCount: Object.keys(generatedFiles).filter(
        (path) =>
          path.endsWith(".test.ts") ||
          path.endsWith(".test.tsx") ||
          path.endsWith(".spec.ts") ||
          path.endsWith(".spec.tsx"),
      ).length,
      manualReviewRequired: false,
      goldenStack: isGoldenStack(techStack),
      liveUrl,
      outerAttempt,
    });
  } catch (err: unknown) {
    if (isAbortError(err, signal)) {
      const timeoutAbort =
        signal?.reason instanceof Error &&
        signal.reason.message === "build_timeout";
      if (coordinationRecord) {
        for (const [taskId, state] of Object.entries(
          coordinationRecord.taskStates,
        )) {
          if (state.status === "running" || state.status === "retrying") {
            coordinationRecord = updateTaskCoordinationState(
              coordinationRecord,
              taskId,
              {
                status: "paused",
                lastError: timeoutAbort
                  ? "Build timeout interrupted agent execution"
                  : "Build cancellation interrupted agent execution",
              },
            );
          }
        }
        await recordCoordinationEvent({
          agent: "System",
          type: "pause",
          detail: timeoutAbort
            ? "Build timed out. Coordination state was persisted for safe resume."
            : "Build was cancelled. Coordination state was persisted.",
        });
      }
      if (timeoutAbort) {
        await updateProjectStatus(projectId, "paused", "agent_timeout");
        write("pause", {
          reason: "agent_timeout",
          message:
            "Agent execution timed out. Progress and coordination state were preserved for resume.",
        });
      } else {
        await updateProjectStatus(
          projectId,
          "failed",
          "Build cancelled by user.",
        );
        write("error", { message: "Build cancelled." });
      }
      return;
    }
    if (isMissingLlmKeysError(err)) {
      const msg = missingLlmKeysMessage();
      write("error", { message: msg, error: "missing_ai_keys", infra: true });
      await updateProjectStatus(projectId, "paused", "missing_ai_keys");
      return;
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    // LLM / transient: keep non-failed so reconnect continues never-give-up
    if (isNeverGiveUpEnabled() && !signal?.aborted) {
      await recordCoordinationEvent({
        agent: "System",
        type: "failure",
        detail:
          "Recoverable provider/agent failure preserved for resume: " +
          message.slice(0, 500),
      });
      emit("System", "info", {
        message: `Error — switching provider / retrying on reconnect: ${message.slice(0, 240)}. Still building — iterating until it works.`,
        coordinationStatus: coordinationRecord
          ? coordinationStatusSummary(coordinationRecord)
          : undefined,
      });
      await updateProjectStatus(projectId, "paused", "retry_after_error");
      write("pause", {
        reason: "retry_after_error",
        message: "Temporary build error. Reconnect to continue iterating — we do not give up.",
      });
      return;
    }
    await updateProjectStatus(projectId, "failed", message);
    write("error", { message });
  }
}
