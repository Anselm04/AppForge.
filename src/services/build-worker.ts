import { runAgentPipeline } from "../agents/pipeline.js";
import {
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

export interface BuildJob {
  projectId: number;
  userId: number;
  description: string;
  techStack: string;
  locale?: string;
  createdAt: string;
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

  const { projectId, userId, description, techStack, locale } = job;
  const controller = new AbortController();
  const timeoutMs = parseInt(process.env.BUILD_SSE_TIMEOUT_MS ?? "1200000", 10);
  const timeout = setTimeout(
    () => controller.abort(),
    Number.isNaN(timeoutMs) ? 1_200_000 : timeoutMs,
  );

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
    if (
      project?.status === "paused" &&
      project.pauseReason === "credits_exhausted"
    ) {
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
      { locale },
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
    await recordBuildOutcome(userId, false, BUILD_CREDIT_COST);
    write("error", { message: msg });
    await updateProjectStatus(projectId, "failed", msg);
  } finally {
    clearTimeout(timeout);
    activeJobs.delete(projectId);
    clearRuntimeBuild(projectId);
  }
}

export function isBuildActive(projectId: number): boolean {
  return activeJobs.has(projectId);
}
