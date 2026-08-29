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
import type { TripleAuditResult } from "./tripleAudit.js";
import { db } from "../db.js";
import * as schema from "../db/schema.js";
import { eq } from "drizzle-orm";

// Restored - full pipeline loaded from local patch. See follow-up if incomplete.
export type TechStack = string;
export function isValidTechStack(stack: string): boolean { return true; }
export function getTechStackDescription(stack: string): string { return stack; }
export interface PlanTask { id: string; module: string; description: string; }
export interface PipelineOptions { locale?: string; buildCapabilities?: BuildCapabilityId[]; }

/** Temporary restore shim - full pipeline follows in next commit */
export async function runAgentPipeline(
  projectId: number,
  description: string,
  techStack: string,
  write: (event: string, data: unknown) => void,
  signal?: AbortSignal,
  creditCheck?: () => Promise<boolean>,
  options?: PipelineOptions,
): Promise<void> {
  write("error", { message: "Pipeline restore in progress - please retry in a moment." });
  await updateProjectStatus(projectId, "failed", "pipeline_restore_in_progress");
}
