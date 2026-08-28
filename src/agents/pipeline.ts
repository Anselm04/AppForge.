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
import { db } from "../db.js";
import * as schema from "../db/schema.js";
import { eq } from "drizzle-orm";

// Maximum retry attempts for the error-recovery loop
const MAX_FIX_RETRIES = 2;

export async function runAgentPipeline(
  projectId: number,
  description: string,
  techStack: string,
  write: SSEWriter,
  signal?: AbortSignal,
  creditCheck?: CreditChecker,
  options?: PipelineOptions,
): Promise<void> {
  // restored from /tmp/AppForge
}
