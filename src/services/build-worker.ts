import { runAgentPipeline } from "../agents/pipeline.js";
import { resolveBuildTimeoutMs } from "../lib/neverGiveUp.js";
import {
  addCredits,
  getCurrentArtifact,
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
import { buildDeploymentDecision } from "../lib/stackDeployment.js";
import { getStackAdapter } from "../lib/stackAdapters.js";
import type { ArtifactIntegrity } from "../lib/artifactIntegrity.js";
import {
  productContractSchema,
  renderProductContractForAgents,
  type ProductContract,
} from "../lib/productContract.js";
import {
  extractBuildJobIdentity,
  parseBuildJob,
  type BuildJob,
} from "../lib/buildJob.js";

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
  snapshot?: {
    id: number;
    version: number;
    integrity: ArtifactIntegrity;
  };
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

/**
 * A queued build whose typed context (prompt, intent, contract, stack) is
 * missing, invalid, or disagrees with the persisted project. The worker never
 * repairs or re-derives that context; it fails the build clearly instead.
 */
export class BuildContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BuildContractError";
  }
}

export const BUILD_CONTRACT_INVALID_MESSAGE =
  "This build was stopped before it started because its product contract was missing or invalid. Any reserved credits were refunded. Please create the project again.";

/**
 * Settles a dequeued job that failed schema validation: refund the attempt's
 * reservation and mark the project failed with a specific reason, so it never
 * sits "running" forever. Only acts when the job's identity is readable and
 * the project really belongs to the job's user.
 */
async function rejectInvalidBuildJob(
  input: unknown,
  reason: string,
): Promise<void> {
  const identity = extractBuildJobIdentity(input);
  if (!identity) {
    logger.error({ reason }, "invalid_build_job_unidentifiable");
    return;
  }
  const { projectId, userId, createdAt, reservationCharged } = identity;
  logger.error({ projectId, reason }, "invalid_build_job_rejected");

  const project = await getProjectById(projectId);
  if (!project || project.userId !== userId) {
    logger.error(
      { projectId, reason },
      "invalid_build_job_project_mismatch_not_settled",
    );
    return;
  }

  if (reservationCharged) {
    // Same attempt key as a normal failed build, so this can never refund twice.
    const refundKey = `build-refund-${projectId}-${createdAt}`;
    try {
      await addCredits(
        userId,
        BUILD_CREDIT_COST,
        "build_refund",
        `Invalid build contract reservation refund for project ${projectId}`,
        refundKey,
      );
    } catch (error: unknown) {
      logger.error(
        { projectId, refundKey, error },
        "invalid_build_job_refund_failed",
      );
    }
  }

  // A different, valid attempt may be running for this project; leave it alone.
  if (activeJobs.has(projectId)) return;

  await updateProjectCreditsSpent(projectId, 0);
  await recordBuildOutcome(userId, false, 0);
  await emit(projectId, "error", {
    error: "build_contract_invalid",
    message: BUILD_CONTRACT_INVALID_MESSAGE,
  });
  await updateProjectStatus(projectId, "failed", "build_contract_invalid");
}

function assertPersistedContract(input: unknown): ProductContract {
  const parsed = productContractSchema.safeParse(input);
  if (!parsed.success) {
    throw new BuildContractError(
      "Persisted project product contract is missing or invalid",
    );
  }
  return parsed.data;
}

export async function runBuildJob(input: unknown): Promise<void> {
  const parsedJob = parseBuildJob(input);
  if (!parsedJob.ok) {
    await rejectInvalidBuildJob(input, parsedJob.reason);
    return;
  }
  const job = parsedJob.job;
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
    productContract,
    createdAt,
    reservationCharged,
  } = job;
  const controller = new AbortController();
  const timeoutMs = resolveBuildTimeoutMs();
  const timeout =
    timeoutMs > 0
      ? setTimeout(
          () => controller.abort(new Error("build_timeout")),
          timeoutMs,
        )
      : null;
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
      throw new BuildContractError("Queued build description is invalid");
    }
    if (!techStack.trim() || techStack.length > 120) {
      throw new BuildContractError("Queued build tech stack is invalid");
    }

    // The job schema already guarantees the queued contract, prompt intent,
    // original prompt and stack agree with each other. The persisted project is
    // the other source of truth: it must carry the identical contract and the
    // same stack, or the build is rejected rather than reinterpreted.
    const queuedContract = productContract;
    const persistedContract = assertPersistedContract(project.productContract);

    if (persistedContract.originalPrompt !== description) {
      throw new BuildContractError(
        "Persisted product contract original prompt mismatch",
      );
    }
    if (persistedContract.selectedTechnologyStack !== techStack) {
      throw new BuildContractError(
        "Persisted product contract selected stack mismatch",
      );
    }
    if (project.techStack && project.techStack !== techStack) {
      throw new BuildContractError(
        "Project stack disagrees with the queued build stack",
      );
    }
    if (JSON.stringify(queuedContract) !== JSON.stringify(persistedContract)) {
      throw new BuildContractError(
        "Queued product contract disagrees with persisted project contract",
      );
    }

    if (project.status === "paused") {
      await resumeProject(projectId);
    }
    await updateProjectStatus(projectId, "running");

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
            snapshotId?: number;
            artifactVersion?: number;
            persistedArtifactSha256?: string;
            httpVerified: true;
            assetsVerified: number;
            browserVerified: boolean;
            verification: string;
            healthPathsVerified: string[];
          }
        | undefined;
      // Structural-only stacks finish as source deliverables: no deploy, no
      // live URL, and the done event says so explicitly.
      const deploymentDecision = buildDeploymentDecision(
        techStack,
        process.env.NODE_ENV,
      );
      const stackAdapter = getStackAdapter(techStack);
      if (deploymentDecision.action === "deploy") {
        const artifact = await getCurrentArtifact(projectId);
        if (!artifact) {
          throw new Error(
            "Validated build has no current snapshot available for production deployment",
          );
        }
        const deployed = await deployValidatedProjectWithRetry({
          projectId,
          projectName: updated.title || `appforge-${projectId}`,
          files: artifact.files,
          productContract: queuedContract,
          snapshot: {
            id: artifact.snapshotId,
            version: artifact.version,
            integrity: artifact.integrity,
          },
        });
        liveUrl = deployed.liveUrl;
        productionCertification = {
          artifactSha256: deployed.artifactSha256,
          httpVerified: deployed.httpVerified,
          assetsVerified: deployed.assetsVerified,
          browserVerified: deployed.browserVerified,
          verification: deployed.verification,
          healthPathsVerified: deployed.healthPathsVerified,
        };
      }
      const stackDelivery = {
        stack: stackAdapter.id,
        structuralOnly: stackAdapter.generationMode === "structural",
        deployment: liveUrl
          ? "deployed"
          : deploymentDecision.action === "skip"
            ? deploymentDecision.deployment
            : "not_deployed",
      };

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
              ...stackDelivery,
            }
          : {
              projectId,
              creditsSpent: BUILD_CREDIT_COST,
              liveUrl,
              productionCertification,
              ...stackDelivery,
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
    if (err instanceof BuildContractError) {
      await emit(projectId, "error", {
        error: "build_contract_invalid",
        message: BUILD_CONTRACT_INVALID_MESSAGE,
      });
      await updateProjectStatus(projectId, "failed", "build_contract_invalid");
    } else {
      await emit(projectId, "error", {
        error: "build_failed",
        message: "Build failed. Please retry or contact support.",
      });
      await updateProjectStatus(projectId, "failed", "build_failed");
    }
  } finally {
    if (timeout) clearTimeout(timeout);
    activeJobs.delete(projectId);
    clearRuntimeBuild(projectId);
  }
}

export function isBuildActive(projectId: number): boolean {
  return activeJobs.has(projectId);
}
