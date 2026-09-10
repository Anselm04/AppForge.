import { runAgentPipeline } from "../agents/pipeline.js";
import { resolveBuildTimeoutMs } from "../lib/neverGiveUp.js";
import {
  addCredits,
  getProjectById,
  getUserCredits,
  pauseProject,
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

  const checkCredits = async () => {
    const current = await getUserCredits(userId);
    if (!current) return false;
    if (current.unlimited || current.tier === "lifetime") return true;
    if (current.balance < 1) {
      await pauseProject(projectId, "credits_exhausted");
      write("pause", {
        reason: "credits_exhausted",
        message: "Build paused: your credits ran out. Purchase more to resume.",
        spent: BUILD_CREDIT_COST,
      });
      return false;
    }
    return true;
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

    await updateProjectCreditsSpent(projectId, BUILD_CREDIT_COST);
    const updated = await getProjectById(projectId);
    const passed = updated?.status === "completed";
    await recordBuildOutcome(userId, passed, BUILD_CREDIT_COST);

    if (passed) {
      void syncComplianceToVanta(projectId, {
        techStack,
        exportedAt: new Date().toISOString(),
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.error({ projectId, err: msg }, "background_build_failed");

    // Refund based on what happened at reservation time, not the user's current
    // entitlement. A customer may upgrade to lifetime while a charged build is
    // running; that must never erase the refund owed for the earlier charge.
    // createdAt is stable for this queued attempt and addCredits uses the key as
    // a unique ledger reference, making recovery exactly-once.
    try {
      if (reservationCharged) {
        const refundKey = `build-refund-${projectId}-${createdAt}`;
        await addCredits(
          userId,
          BUILD_CREDIT_COST,
          "build_refund",
          `Failed build reservation refund for project ${projectId}`,
          refundKey,
        );
        await updateProjectCreditsSpent(projectId, 0);
        logger.info({ projectId, refundKey }, "failed_build_reservation_refunded");
      }
    } catch (refundErr: unknown) {
      logger.error(
        {
          projectId,
          error:
            refundErr instanceof Error
              ? refundErr.message
              : "Unknown refund error",
        },
        "failed_build_refund_error",
      );
    }

    await recordBuildOutcome(userId, false, 0);
    write("error", { message: msg });
    await updateProjectStatus(projectId, "failed", msg);
  } finally {
    if (timeout) clearTimeout(timeout);
    activeJobs.delete(projectId);
    clearRuntimeBuild(projectId);
  }
}

export function isBuildActive(projectId: number): boolean {
  return activeJobs.has(projectId);
}
