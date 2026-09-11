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

export interface BuildJob {
  projectId: number;
  userId: number;
  description: string;
  techStack: string;
  locale?: string;
  buildCapabilities?: string[];
  createdAt: string;
  /** True only when this queued attempt actually deducted the build reservation. */
  reservationCharged: boolean;
}

const activeJobs = new Set<number>();

async function emit(projectId: number, event: string, data: unknown) {
  await appendBuildEvent(projectId, event, data);
  publishRuntimeBuildEvent(projectId, event, data);
  await publishBuildEvent(projectId, event, data);
}

export async function runBuildJob(job: BuildJob): Promise<void> {
  if (activeJobs.has(job.projectId)) return;
  activeJobs.add(job.projectId);

  const {
    projectId,
    userId,
    description,
    techStack,
    locale,
    buildCapabilities,
    createdAt,
    reservationCharged,
  } = job;
  const controller = new AbortController();
  const timeoutMs = resolveBuildTimeoutMs();
  const timeout =
    timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

  const write = (event: string, data: unknown) => {
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
    if (project?.status === "paused") {
      await resumeProject(projectId);
    }
    await updateProjectStatus(projectId, "running");

    await runAgentPipeline(
      projectId,
      description,
      techStack,
      write,
      controller.signal,
      checkCredits,
      {
        locale,
        buildCapabilities: buildCapabilities as BuildCapabilityId[] | undefined,
      },
    );

    const updated = await getProjectById(projectId);
    const passed = updated?.status === "completed";

    if (passed) {
      await updateProjectCreditsSpent(projectId, BUILD_CREDIT_COST);
      await recordBuildOutcome(userId, true, BUILD_CREDIT_COST);
      void syncComplianceToVanta(projectId, {
        techStack,
        exportedAt: new Date().toISOString(),
      });
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
    write("error", {
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
