import { runAgentPipeline } from "../agents/pipeline.js";
import { resolveBuildTimeoutMs } from "../lib/neverGiveUp.js";
import {
  addCredits,
  getProjectById,
  resumeProject,
  updateProjectCreditsSpent,
  updateProjectStatus,
} from "../db.js";
import { BUILD_CREDIT_COST } from "../lib/credits.js";
import { logger } from "../_core/logger.js";
import { appendBuildEvent } from "./build-event-store.js";
import {
  clearRuntimeBuild,
  publishRuntimeBuildEvent,
} from "./build-runtime.js";
import { publishBuildEvent } from "./build-queue.js";
import { syncComplianceToVanta } from "./vantaSync.js";
import { recordBuildOutcome } from "../db/buildStats.js";
import type { BuildCapabilityId } from "../lib/buildCapabilities.js";
import { deployValidatedProject } from "./productionAutoDeploy.js";
import {
  classifyProductIntent,
  renderProductContractForAgents,
  validateProductContract,
  type ProductContract,
  type PromptIntent,
} from "../lib/productContract.js";

export interface BuildJob {
  projectId: number;
  userId: number;
  description: string;
  techStack: string;
  locale?: string;
  buildCapabilities?: string[];
  promptIntent?: PromptIntent;
  productContract: ProductContract;
  createdAt: string;
  /** True only when this queued attempt actually deducted the build reservation. */
  reservationCharged: boolean;
}

const activeJobs = new Set<number>();
const DEPLOY_MAX_ATTEMPTS = 3;
const DEPLOY_RETRY_BASE_MS = 1_000;

async function emit(projectId: number, event: string, data: unknown) {
  await appendBuildEvent(projectId, event, data);
  publishRuntimeBuildEvent(projectId, event, data);
  await publishBuildEvent(projectId, event, data);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function deployValidatedProjectWithRetry(input: {
  projectId: number;
  projectName: string;
  files: Record<string, string>;
  productContract: ProductContract;
}) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= DEPLOY_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await deployValidatedProject(input);
    } catch (error) {
      lastError = error;
      logger.warn(
        {
          error,
          projectId: input.projectId,
          attempt,
          maxAttempts: DEPLOY_MAX_ATTEMPTS,
        },
        "validated_project_deploy_attempt_failed",
      );
      if (attempt < DEPLOY_MAX_ATTEMPTS) {
        await sleep(DEPLOY_RETRY_BASE_MS * 2 ** (attempt - 1));
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Validated project deployment failed after retries");
}

async function refundActiveDuplicateReservation(job: BuildJob): Promise<void> {
  if (!job.reservationCharged) return;

  const refundKey = `build-duplicate-refund-${job.projectId}-${job.createdAt}`;
  try {
    await addCredits(
      job.userId,
      BUILD_CREDIT_COST,
      "build_refund",
      `Duplicate build reservation refund for project ${job.projectId}`,
      refundKey,
    );
    logger.warn(
      { projectId: job.projectId, refundKey },
      "active_duplicate_build_refunded",
    );
  } catch (error: unknown) {
    logger.error(
      { projectId: job.projectId, refundKey, error },
      "active_duplicate_build_refund_failed",
    );
    throw error;
  }
}

export async function runBuildJob(job: BuildJob): Promise<void> {
  if (activeJobs.has(job.projectId)) {
    await refundActiveDuplicateReservation(job);
    return;
  }
  activeJobs.add(job.projectId);

  const {
    projectId,
    userId,
    description,
    techStack,
    locale,
    buildCapabilities,
    promptIntent,
    productContract,
    createdAt,
    reservationCharged,
  } = job;
  const controller = new AbortController();
  const timeoutMs = resolveBuildTimeoutMs();
  const timeout =
    timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
  let pendingDone: unknown = null;

  const write = (event: string, data: unknown) => {
    // The pipeline may finish generation before production deployment is proven.
    // Hold the terminal done event until Fly is live and smoke-tested so the UI
    // cannot claim customer success early.
    if (event === "done") {
      pendingDone = data;
      return;
    }
    void emit(projectId, event, data);
  };

  // Admission already reserved the full build price. Pipeline phases are not
  // separately billable, so a customer with exactly BUILD_CREDIT_COST must not
  // be paused just because the reservation reduced their remaining balance to 0.
  const checkCredits = async () => true;

  const refundReservation = async (reason: string) => {
    if (!reservationCharged) return;
    const refundKey = `build-refund-${projectId}-${createdAt}`;
    await addCredits(
      userId,
      BUILD_CREDIT_COST,
      "build_refund",
      `${reason} reservation refund for project ${projectId}`,
      refundKey,
    );
    await updateProjectCreditsSpent(projectId, 0);
    logger.info({ projectId, refundKey }, "build_reservation_refunded");
  };

  try {
    const project = await getProjectById(projectId);
    if (!project) {
      throw new Error(
        "Queued build references a project that no longer exists",
      );
    }
    if (project.userId !== userId) {
      throw new Error(
        "Queued build project ownership does not match the build actor",
      );
    }
    if (!description.trim() || description.length > 20_000) {
      throw new Error("Queued build description is invalid");
    }
    if (!techStack.trim() || techStack.length > 120) {
      throw new Error("Queued build tech stack is invalid");
    }

    if (project.status === "paused") {
      await resumeProject(projectId);
    }
    await updateProjectStatus(projectId, "running");

    const resolvedPromptIntent =
      promptIntent ?? classifyProductIntent(description);
    if (
      resolvedPromptIntent.ambiguous ||
      !resolvedPromptIntent.primaryProductType
    ) {
      throw new Error(
        resolvedPromptIntent.clarificationQuestions[0] ??
          "Queued build prompt is ambiguous",
      );
    }
    const queuedContract = validateProductContract(productContract);
    const persistedContract = validateProductContract(project.productContract);

    if (queuedContract.originalPrompt !== description) {
      throw new Error("Queued product contract original prompt mismatch");
    }
    if (persistedContract.originalPrompt !== description) {
      throw new Error("Persisted product contract original prompt mismatch");
    }
    if (queuedContract.selectedTechnologyStack !== techStack) {
      throw new Error("Queued product contract selected stack mismatch");
    }
    if (persistedContract.selectedTechnologyStack !== techStack) {
      throw new Error("Persisted product contract selected stack mismatch");
    }
    if (JSON.stringify(queuedContract) !== JSON.stringify(persistedContract)) {
      throw new Error("Queued product contract disagrees with persisted project contract");
    }

    const canonicalAgentPrompt = [
      description,
      "",
      renderProductContractForAgents(queuedContract),
    ].join("\n");

    await runAgentPipeline(
      projectId,
      canonicalAgentPrompt,
      techStack,
      write,
      controller.signal,
      checkCredits,
      {
        locale,
        buildCapabilities: buildCapabilities as BuildCapabilityId[] | undefined,
        productContract: queuedContract,
      },
    );

    const updated = await getProjectById(projectId);
    if (!updated || updated.userId !== userId) {
      throw new Error(
        "Project disappeared or changed ownership during build execution",
      );
    }
    const passed = updated?.status === "completed";

    if (passed) {
      let liveUrl: string | undefined;
      let productionCertification:
        | {
            artifactSha256: string;
            httpVerified: true;
            assetsVerified: number;
            browserVerified: true;
          }
        | undefined;
      if (process.env.NODE_ENV === "production") {
        const files =
          (updated.generatedFiles as Record<string, string> | null) ?? {};
        if (Object.keys(files).length === 0) {
          throw new Error(
            "Validated build has no generated files available for production deployment",
          );
        }
        const deployed = await deployValidatedProjectWithRetry({
          projectId,
          projectName: updated.title || `appforge-${projectId}`,
          files,
          productContract: queuedContract,
        });
        liveUrl = deployed.liveUrl;
        productionCertification = {
          artifactSha256: deployed.artifactSha256,
          httpVerified: deployed.httpVerified,
          assetsVerified: deployed.assetsVerified,
          browserVerified: deployed.browserVerified,
        };
      }

      await updateProjectCreditsSpent(projectId, BUILD_CREDIT_COST);
      await recordBuildOutcome(userId, true, BUILD_CREDIT_COST);
      void syncComplianceToVanta(projectId, {
        techStack,
        productContract: queuedContract,
        exportedAt: new Date().toISOString(),
      });

      const donePayload =
        pendingDone && typeof pendingDone === "object"
          ? {
              ...(pendingDone as Record<string, unknown>),
              liveUrl,
              productionCertification,
            }
          : {
              projectId,
              creditsSpent: BUILD_CREDIT_COST,
              liveUrl,
              productionCertification,
            };
      await emit(projectId, "done", donePayload);
    } else {
      // The pipeline intentionally returns for paused, failed, cancelled and
      // recoverable states. Those are not completed paid builds. Refund the
      // reservation now so a later resume/retry cannot double-charge it.
      await refundReservation("Incomplete build");
      await updateProjectCreditsSpent(projectId, 0);
      await recordBuildOutcome(userId, false, 0);
    }
  } catch (err: unknown) {
    logger.error({ projectId, error: err }, "background_build_failed");

    // Refund based on what happened at reservation time, not the user's current
    // entitlement. The attempt key makes recovery exactly-once.
    try {
      await refundReservation("Failed build");
    } catch (refundErr: unknown) {
      logger.error(
        { projectId, error: refundErr },
        "failed_build_refund_error",
      );
    }

    await recordBuildOutcome(userId, false, 0);
    await emit(projectId, "error", {
      error: "build_failed",
      message: "Build failed. Please retry or contact support.",
    });
    await updateProjectStatus(projectId, "failed", "build_failed");
  } finally {
    if (timeout) clearTimeout(timeout);
    activeJobs.delete(projectId);
    clearRuntimeBuild(projectId);
  }
}

export function isBuildActive(projectId: number): boolean {
  return activeJobs.has(projectId);
}
