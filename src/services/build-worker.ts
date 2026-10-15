import {
  withBuildExecutionLease,
  currentBuildExecutionLease,
  appendBuildAgentLog,
  registerBuildLeaseAbort,
  assertCurrentBuildLease,
  BuildExecutionLeaseLostError,
} from "./buildExecutionLease.js";
import { runAgentPipeline } from "../agents/pipeline.js";
import { resolveBuildTimeoutMs } from "../lib/neverGiveUp.js";
import {
  addCredits,
  getCurrentArtifact,
  getProjectById,
  recordProjectEvidence,
  resumeProject,
  updateProjectBuildStage,
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
import { recordBuildOutcome } from "../db/buildStats.js";
import type { BuildCapabilityId } from "../lib/buildCapabilities.js";
import { buildDeploymentDecision } from "../lib/stackDeployment.js";
import { getStackAdapter } from "../lib/stackAdapters.js";
import {
  productContractSchema,
  renderProductContractForAgents,
  type ProductContract,
} from "../lib/productContract.js";
import {
  incrementOperationalMetric,
  startOperationalTrace,
} from "../lib/operationsObservability.js";
import {
  extractBuildJobIdentity,
  parseBuildJob,
  type BuildJob,
} from "../lib/buildJob.js";
import { recordKnownGoodCheckpoint } from "./recovery.js";
import {
  evaluateCertification,
  requirementBehaviorVerified,
  type CertificationDecision,
} from "../lib/certificationLogic.js";
import {
  blockedDependencyNodes,
  buildDependencyEvidence,
  resolveStackDependencyGraph,
  type StackDependencyGraph,
} from "../lib/stackDependencyResolver.js";
import {
  evaluateFinalProductFactoryFlow,
  type FinalProductFactoryFlowReport,
} from "../lib/finalProductFactoryFlow.js";

import {
  assertBuildExecutionReady,
  BuildRuntimeUnavailableError,
} from "./buildExecutionReadiness.js";

type ActiveBuild = {
  createdAt: string;
  completion: Promise<void>;
  finished: boolean;
  abort?: (error: Error) => void;
};
const activeJobs = new Map<number, ActiveBuild>();

function validationPassed(value: unknown): boolean {
  return (
    !!value &&
    typeof value === "object" &&
    (value as { passed?: unknown }).passed === true
  );
}

function requirementsResolved(value: unknown): boolean {
  return (
    !!value &&
    typeof value === "object" &&
    Array.isArray(
      (value as { unresolvedMustHaveIds?: unknown }).unresolvedMustHaveIds,
    ) &&
    (value as { unresolvedMustHaveIds: unknown[] }).unresolvedMustHaveIds
      .length === 0
  );
}

function securityAuditPassed(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const audit = value as { passed?: unknown; security?: unknown };
  return (
    audit.passed === true &&
    typeof audit.security === "number" &&
    audit.security >= 80
  );
}

async function assertCurrentBuildLeaseIfTerminal(event: string): Promise<void> {
  if (event === "done" || event === "error" || event === "pause")
    await assertCurrentBuildLease();
}

async function emit(projectId: number, event: string, data: unknown) {
  const lease = currentBuildExecutionLease();
  const payload =
    lease && data && typeof data === "object"
      ? {
          ...data,
          attemptCreatedAt: lease.createdAt,
          executionId: lease.executionId,
        }
      : data;
  if (event === "agent" && lease) await appendBuildAgentLog(projectId, payload);
  else await appendBuildEvent(projectId, event, payload);
  await assertCurrentBuildLeaseIfTerminal(event);
  publishRuntimeBuildEvent(projectId, event, payload);
  await publishBuildEvent(projectId, event, payload);
}

export class BuildContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BuildContractError";
  }
}

export const BUILD_CONTRACT_INVALID_MESSAGE =
  "This build was stopped before it started because its product contract was missing or invalid. Any reserved credits were refunded. Please create the project again.";

/**
 * Thrown by the pre-build dependency gate when `resolveStackDependencyGraph`
 * reports `allowed === false` for the selected stack. This stops the build
 * before the agent pipeline and isolated runner ever start — it is never
 * thrown for `productionEligible === false` alone, which is allowed to
 * proceed to its honest capability ceiling and is instead enforced later by
 * `certificationLogic.ts`.
 */
export class BuildDependencyBlockedError extends Error {
  constructor(public readonly graph: StackDependencyGraph) {
    super(describeBlockedDependencyGraph(graph));
    this.name = "BuildDependencyBlockedError";
  }
}

function describeBlockedDependencyGraph(graph: StackDependencyGraph): string {
  const blocked = blockedDependencyNodes(graph);
  const detail = blocked
    .map(
      (node) =>
        `${node.adapterId} is currently "${node.resolvedState ?? "unknown"}" (${node.status}) but this build path requires at least "${node.minimumCapabilityLevel}"`,
    )
    .join("; ");
  return `Build blocked before execution: ${detail || "a required external technology adapter is unavailable"}.`;
}

/** Public, UI-safe reason for a pre-build dependency refusal (no stack traces). */
export function buildDependencyBlockedReason(graph: StackDependencyGraph) {
  return {
    error: "build_dependency_blocked" as const,
    message: describeBlockedDependencyGraph(graph),
    stack: graph.stackId,
    productType: graph.productType,
    blockedDependencies: blockedDependencyNodes(graph).map((node) => ({
      adapterId: node.adapterId,
      purpose: node.purpose,
      status: node.status,
      requiredCapability: node.minimumCapabilityLevel,
      currentCapability: node.resolvedState,
      resolvedVersion: node.resolvedVersion,
      runnerAvailable: node.runnerAvailable,
      message: node.message,
    })),
  };
}

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
  const existing = activeJobs.get(job.projectId);
  // BullMQ redelivery represents the same reserved attempt, not a new charge.
  if (existing?.createdAt === job.createdAt) return existing.completion;
  if (existing && Date.parse(job.createdAt) < Date.parse(existing.createdAt))
    return;
  const entry: ActiveBuild = {
    createdAt: job.createdAt,
    completion: Promise.resolve(),
    finished: false,
  };
  activeJobs.set(job.projectId, entry);
  let acquired = false;
  entry.completion = (async () => {
    try {
      await withBuildExecutionLease(job, () => {
        acquired = true;
        existing?.abort?.(new BuildExecutionLeaseLostError());
        return runOwnedBuildJob(job, entry);
      });
    } catch (error) {
      if (!(error instanceof BuildExecutionLeaseLostError)) throw error;
      logger.info(
        { projectId: job.projectId },
        "obsolete_build_worker_stopped",
      );
    } finally {
      entry.finished = true;
      if (activeJobs.get(job.projectId) === entry) {
        if (!acquired && existing && !existing.finished)
          activeJobs.set(job.projectId, existing);
        else activeJobs.delete(job.projectId);
      }
    }
  })();
  return entry.completion;
}

async function runOwnedBuildJob(
  job: BuildJob,
  entry: ActiveBuild,
): Promise<void> {
  const buildTrace = startOperationalTrace({
    component: "build",
    operation: "run_build_job",
    metadata: { projectId: job.projectId, userId: job.userId },
  });
  let buildTraceStatus: "ok" | "error" = "error";
  let buildMetricRecorded = false;

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
  entry.abort = (error) => controller.abort(error);
  registerBuildLeaseAbort(entry.abort);
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
    // Pipeline completion is captured until the validated artifact is saved.
    // Hold the terminal done event until Fly is live and smoke-tested so the UI
    // cannot claim customer success early.
    if (event === "done") {
      pendingDone = data;
      return;
    }
    void emit(projectId, event, data).catch((error: unknown) => {
      if (!(error instanceof BuildExecutionLeaseLostError))
        logger.error({ projectId, error }, "build_event_persistence_failed");
    });
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

    // Pre-build dependency gate: resolve the same external-adapter graph
    // certificationLogic.ts uses at the end of the build, but check it here
    // too, before the isolated runner or agent pipeline spend any resources.
    // Only `allowed === false` stops the build; `productionEligible === false`
    // is allowed to proceed to its honest capability ceiling and is enforced
    // later by certification instead (defense in depth, not duplication).
    const dependencyGraph = resolveStackDependencyGraph(
      techStack,
      queuedContract.productType,
    );
    await recordProjectEvidence({
      projectId,
      kind: "dependency_resolution",
      payload: {
        stack: dependencyGraph.stackId,
        productType: dependencyGraph.productType,
        allowed: dependencyGraph.allowed,
        productionEligible: dependencyGraph.productionEligible,
        capabilityCeiling: dependencyGraph.capabilityCeiling,
        dependencies: buildDependencyEvidence(dependencyGraph),
      },
    });
    if (!dependencyGraph.allowed) {
      throw new BuildDependencyBlockedError(dependencyGraph);
    }

    await assertBuildExecutionReady();

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
    const passed =
      updated?.status === "validated" ||
      updated?.status === "production-certified";

    if (passed) {
      const liveUrl = undefined;
      const productionCertification = undefined;
      // A completed pipeline must have an immutable validated snapshot before
      // AppForge records any customer success or recovery checkpoint.
      const artifact = await getCurrentArtifact(projectId);
      if (!artifact) {
        throw new Error(
          "Validated build has no current snapshot available for recovery",
        );
      }
      await recordKnownGoodCheckpoint({
        projectId,
        snapshotId: artifact.snapshotId,
        artifactVersion: artifact.version,
        artifactSha256: artifact.integrity.sha256,
        source: "validated_artifact",
      });

      // Building never chooses a hosting provider. The owner receives the
      // validated artifact and explicitly chooses export, preview or deployment.
      const deploymentDecision = buildDeploymentDecision(
        techStack,
        process.env.NODE_ENV,
      );
      const stackAdapter = getStackAdapter(techStack);
      const currentRequirementsResolved = requirementsResolved(
        artifact.requirementManifest,
      );
      const behavioralTestsVerified = requirementBehaviorVerified(
        artifact.requirementManifest,
      );
      const runtimeVerified =
        stackAdapter.generationMode === "runnable" &&
        validationPassed(artifact.validationResult);
      const snapshotSecurityVerified = securityAuditPassed(
        artifact.auditScores,
      );
      let certificationDecision: CertificationDecision;
      let finalProductFactoryFlow: FinalProductFactoryFlowReport;

      certificationDecision = evaluateCertification({
        productContract: queuedContract,
        dependencyGraph,
        evidence: {
          artifactPresent: true,
          generatedFileCount: Object.keys(artifact.files).length,
          requirementsResolved: currentRequirementsResolved,
          behavioralTestsVerified,
          runtimeVerified,
          securityVerified: snapshotSecurityVerified,
          deploymentVerified: false,
          monetizationVerified: false,
          operationalVerified: false,
          // A saved checkpoint is recovery material, not proof that restoring
          // and reopening this artifact succeeds.
          recoveryVerified: false,
        },
      });
      finalProductFactoryFlow = evaluateFinalProductFactoryFlow({
        project: updated,
        artifact: {
          version: artifact.version,
          integrity: artifact.integrity,
          files: artifact.files,
          validationResult: artifact.validationResult,
          requirementManifest: artifact.requirementManifest,
        },
        certificationDecision,
        deployment: null,
        monetizationVerified: false,
        recoveryVerified: false,
      });
      await updateProjectStatus(projectId, "validated");
      await updateProjectBuildStage(projectId, certificationDecision.status, {
        outputMaturity:
          stackAdapter.generationMode === "structural"
            ? "structural"
            : runtimeVerified
              ? "runnable"
              : "structural",
      });
      await recordProjectEvidence({
        projectId,
        kind: "certification",
        artifactVersion: artifact.version,
        payload: {
          ...certificationDecision,
          snapshotId: artifact.snapshotId,
          artifactSha256: artifact.integrity.sha256,
          reason: deploymentDecision.deployment,
          productionReady: false,
          finalProductFactoryFlow,
          limitations: finalProductFactoryFlow.limitations,
        },
      });

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

      const donePayload =
        pendingDone && typeof pendingDone === "object"
          ? {
              ...(pendingDone as Record<string, unknown>),
              liveUrl,
              productionCertification,
              productionReady: finalProductFactoryFlow.productionReady,
              finalProductFactoryFlow,
              limitations: finalProductFactoryFlow.limitations,
              ...stackDelivery,
            }
          : {
              projectId,
              creditsSpent: BUILD_CREDIT_COST,
              liveUrl,
              productionCertification,
              productionReady: finalProductFactoryFlow.productionReady,
              finalProductFactoryFlow,
              limitations: finalProductFactoryFlow.limitations,
              ...stackDelivery,
            };
      await emit(projectId, "done", donePayload);
      buildTraceStatus = "ok";
      incrementOperationalMetric("appforge_builds_total", {
        status: "completed",
      });
      buildMetricRecorded = true;
    } else {
      // Approval pauses are an intentional handoff after planning. Keep the
      // existing reservation so resuming after approval does not charge twice.
      const pausedForApproval =
        updated?.status === "paused" &&
        updated?.pauseReason === "approval_required";
      if (!pausedForApproval) {
        await refundReservation("Incomplete build");
        await updateProjectCreditsSpent(projectId, 0);
        await recordBuildOutcome(userId, false, 0);
        incrementOperationalMetric("appforge_builds_total", {
          status: "incomplete",
        });
        buildMetricRecorded = true;
      } else {
        incrementOperationalMetric("appforge_builds_total", {
          status: "awaiting_approval",
        });
        buildMetricRecorded = true;
      }
    }
  } catch (err: unknown) {
    if (err instanceof BuildExecutionLeaseLostError) throw err;
    await assertCurrentBuildLease();
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
    if (err instanceof BuildRuntimeUnavailableError) {
      await emit(projectId, "error", {
        error: "validation_unavailable",
        message: err.message,
      });
      await updateProjectStatus(projectId, "paused", "validation_unavailable");
    } else if (err instanceof BuildContractError) {
      await emit(projectId, "error", {
        error: "build_contract_invalid",
        message: BUILD_CONTRACT_INVALID_MESSAGE,
      });
      await updateProjectStatus(projectId, "failed", "build_contract_invalid");
    } else if (err instanceof BuildDependencyBlockedError) {
      // Refused before execution, not a mid-build failure: distinct status
      // reason and a structured, non-stack-trace explanation for the UI/API.
      await emit(projectId, "error", buildDependencyBlockedReason(err.graph));
      await updateProjectStatus(
        projectId,
        "failed",
        "build_dependency_blocked",
      );
    } else {
      await emit(projectId, "error", {
        error: "build_failed",
        message: "Build failed. Please retry or contact support.",
      });
      await updateProjectStatus(projectId, "failed", "build_failed");
    }
  } finally {
    buildTrace.end(buildTraceStatus, { projectId });
    if (buildTraceStatus === "error" && !buildMetricRecorded) {
      incrementOperationalMetric("appforge_builds_total", { status: "error" });
    }
    if (timeout) clearTimeout(timeout);
    if (activeJobs.get(projectId) === entry) clearRuntimeBuild(projectId);
  }
}

export function isBuildActive(projectId: number): boolean {
  return activeJobs.has(projectId);
}
