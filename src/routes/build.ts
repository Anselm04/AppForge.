import { Router, Request, Response } from "express";
import { db } from "../db.js";
import * as schema from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { deployToVercel } from "../services/deployer.js";
import { watchProject } from "../agents/selfHealing.js";
import {
  getBuildEventsSince,
  clearBuildEvents,
} from "../services/build-event-store.js";
import { subscribeRuntimeBuildEvents } from "../services/build-runtime.js";
import { enqueueBuild, subscribeBuildEvents } from "../services/build-queue.js";
import { isBuildActive } from "../services/build-worker.js";
import { canStartBuild } from "../lib/buildConcurrency.js";
import {
  getProjectById,
  pauseProject,
  ensureUserCredits,
  deductCredits,
  addCredits,
  getUserCredits,
  updateProjectFiles,
  getSeniorDevTaskById,
  updateSeniorDevTask,
  updateSeniorDevTaskStatus,
} from "../db.js";
import {
  BUILD_CREDIT_COST,
  SENIOR_DEV_CREDIT_COST,
  creditsExhaustedBody,
} from "../lib/credits.js";
import {
  runSeniorDevAgent,
  resumeAfterApproval,
  type ProgressEvent,
} from "../agents/seniorDevAgent.js";
import { logger } from "../_core/logger.js";
import { claimSeniorDevResume } from "../services/senior-dev-claim.js";
import {
  claimProjectBuildStart,
  releaseProjectBuildClaim,
} from "../services/build-claim.js";

const router = Router();

const BUILD_COST = BUILD_CREDIT_COST;
const SENIOR_DEV_BASE_COST = SENIOR_DEV_CREDIT_COST;

/** SSE endpoint that streams the multi-agent pipeline with credit tracking */
router.get("/:projectId", async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.projectId, 10);
  if (Number.isNaN(projectId)) {
    res.status(400).json({ error: "Invalid projectId" });
    return;
  }

  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const project = await getProjectById(projectId);
  if (!project || project.userId !== user.id) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const existingFiles =
    (project.generatedFiles as Record<string, string> | null) ?? {};
  if (project.status === "completed" && Object.keys(existingFiles).length > 0) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    res.write(
      `event: done\ndata: ${JSON.stringify({
        status: "completed",
        projectId,
        fileCount: Object.keys(existingFiles).length,
        reused: true,
      })}\n\n`,
    );
    res.end();
    return;
  }

  const isActive = project.status === "running" || isBuildActive(projectId);
  const userCancelled =
    project.status === "paused" &&
    (project.pauseReason === "user_cancelled" ||
      project.pauseReason === "user-cancelled");
  const shouldStart =
    !isActive &&
    !userCancelled &&
    (project.status === "pending" ||
      project.status === "failed" ||
      project.status === "paused");

  if (shouldStart) {
    const concurrency = await canStartBuild(user.id);
    if (!concurrency.allowed) {
      res.status(429).json({
        error: "concurrent_build_limit",
        message: `You have ${concurrency.active} builds running (limit ${concurrency.limit}). Wait for one to finish.`,
        active: concurrency.active,
        limit: concurrency.limit,
      });
      return;
    }

    const credits = await ensureUserCredits(user.id);
    const unlimited = !!credits.unlimited || credits.tier === "lifetime";
    if (!unlimited && credits.balance < BUILD_COST) {
      res
        .status(402)
        .json(
          creditsExhaustedBody(credits.balance, BUILD_COST, "start this build"),
        );
      return;
    }

    const claimed = await claimProjectBuildStart(projectId, user.id);
    if (claimed) {
      const createdAt = new Date().toISOString();
      const reservationCharged = !unlimited;
      let charged = false;

      try {
        if (reservationCharged) {
          await deductCredits(user.id, BUILD_COST, projectId, "Build reservation");
          charged = true;
        }

        await clearBuildEvents(projectId);
        await enqueueBuild({
          projectId,
          userId: user.id,
          description: project.description || "",
          techStack: project.techStack || "react-node",
          locale: (project as { locale?: string }).locale ?? "en",
          buildCapabilities:
            (project as { buildCapabilities?: string[] }).buildCapabilities ?? [],
          createdAt,
          reservationCharged,
        });
      } catch (err: unknown) {
        if (charged) {
          const refundKey = `build-start-refund-${projectId}-${createdAt}`;
          try {
            await addCredits(
              user.id,
              BUILD_COST,
              "build_refund",
              `Build start refund for project ${projectId}`,
              refundKey,
            );
          } catch (refundErr: unknown) {
            logger.error(
              { projectId, refundKey, error: refundErr },
              "build_start_refund_error",
            );
          }
        }

        await releaseProjectBuildClaim(
          projectId,
          user.id,
          project.status,
          project.pauseReason ?? null,
        );
        logger.error({ projectId, error: err }, "build_start_failed");
        res.status(500).json({ error: "build_start_failed" });
        return;
      }
    }
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  let closed = false;
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) {
      res.write(`event: ping\ndata: ${JSON.stringify({ t: Date.now() })}\n\n`);
    }
  }, 15000);

  const write = (event: string, data: unknown) => {
    if (!closed && !res.writableEnded) {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  const historical = await getBuildEventsSince(projectId, 0);
  let sawTerminal = false;
  for (const row of historical) {
    write(row.event, row.payload);
    if (row.event === "done" || row.event === "error") sawTerminal = true;
  }

  if (sawTerminal) {
    clearInterval(heartbeat);
    res.end();
    return;
  }

  const unsubRuntime = subscribeRuntimeBuildEvents(
    projectId,
    ({ event, data }) => {
      write(event, data);
      if (event === "done" || event === "error") {
        closed = true;
        clearInterval(heartbeat);
        if (!res.writableEnded) res.end();
      }
    },
  );

  const unsubRedis = await subscribeBuildEvents(projectId, (event, data) => {
    write(event, data);
    if (event === "done" || event === "error") {
      closed = true;
      clearInterval(heartbeat);
      if (!res.writableEnded) res.end();
    }
  });

  req.on("close", () => {
    closed = true;
    clearInterval(heartbeat);
    unsubRuntime();
    void unsubRedis();
  });
});

/** SSE endpoint for Senior Dev Agent: streams plan + execution + validation */
router.get("/senior/:taskId", async (req: Request, res: Response) => {
  const taskId = parseInt(req.params.taskId, 10);
  if (Number.isNaN(taskId)) {
    res.status(400).json({ error: "Invalid taskId" });
    return;
  }

  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const task = await getSeniorDevTaskById(taskId);
  if (!task || task.userId !== user.id) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const project = await getProjectById(task.projectId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  if (task.status === "completed") {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    res.write(
      `event: done\ndata: ${JSON.stringify({ status: "completed", summary: task.summary ?? "", creditsSpent: task.creditsSpent ?? 0, reused: true })}\n\n`,
    );
    res.end();
    return;
  }

  if (task.status === "awaiting_approval") {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    res.write(
      `event: awaiting_approval\ndata: ${JSON.stringify({ status: "awaiting_approval", plan: task.plan, summary: task.summary ?? "", reused: true })}\n\n`,
    );
    res.end();
    return;
  }

  if (task.status === "executing") {
    res.status(409).json({
      error: "senior_dev_task_active",
      message: "This Senior Dev task is already executing.",
    });
    return;
  }

  const credits = await ensureUserCredits(user.id);
  const seniorUnlimited = !!credits.unlimited || credits.tier === "lifetime";
  if (!seniorUnlimited && credits.balance < SENIOR_DEV_BASE_COST) {
    res
      .status(402)
      .json(
        creditsExhaustedBody(
          credits.balance,
          SENIOR_DEV_BASE_COST,
          "use the Senior Dev Agent",
        ),
      );
    return;
  }

  const reservationId = `senior-dev-${task.id}-${crypto.randomUUID()}`;
  if (!seniorUnlimited) {
    await deductCredits(
      user.id,
      SENIOR_DEV_BASE_COST,
      task.projectId,
      `Senior Dev Agent reservation ${reservationId}`,
    );
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000);
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) {
      res.write(`event: ping\ndata: ${JSON.stringify({ t: Date.now() })}\n\n`);
    }
  }, 15000);

  req.on("close", () => {
    clearTimeout(timeout);
    clearInterval(heartbeat);
    controller.abort();
  });

  const write = (event: string, data: unknown) => {
    if (!res.writableEnded) {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  const onProgress = (e: ProgressEvent) => {
    if (controller.signal.aborted) return;
    write("progress", e);
  };

  try {
    const files =
      (project.generatedFiles as Record<string, string> | null) ?? {};

    const agentTask = {
      id: task.id,
      projectId: task.projectId,
      userId: task.userId,
      request: task.request,
      mode: task.mode as "collaborative" | "autonomous",
      plan: task.plan as any,
      planApproved: task.planApproved ?? false,
      status: task.status as any,
      changes: (task.changes as any) ?? [],
      validationResults: (task.validationResult as any) ?? [],
      summary: task.summary ?? "",
      creditsSpent: task.creditsSpent ?? 0,
    };

    const result = await runSeniorDevAgent(
      agentTask,
      { ...files },
      project.techStack || "react-node",
      onProgress,
    );

    if (agentTask.status === "awaiting_approval") {
      await updateSeniorDevTask(task.id, {
        status: "awaiting_approval",
        plan: agentTask.plan,
        planApproved: false,
        summary: result.summary,
        creditsSpent: agentTask.creditsSpent,
      });
      write("awaiting_approval", {
        status: "awaiting_approval",
        plan: agentTask.plan,
        summary: result.summary,
      });
      return;
    }

    if (Object.keys(result.files).length > 0) {
      await updateProjectFiles(task.projectId, result.files);
    }

    await updateSeniorDevTask(task.id, {
      status: agentTask.status === "failed" ? "failed" : "completed",
      plan: agentTask.plan,
      planApproved: agentTask.planApproved,
      changes: result.changes,
      validationResult: result.validations,
      summary: result.summary,
      creditsSpent: agentTask.creditsSpent,
    });

    write("done", {
      status: agentTask.status === "failed" ? "failed" : "completed",
      summary: result.summary,
      filesChanged: result.changes.map((c) => c.path),
      creditsSpent: agentTask.creditsSpent,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.error({ taskId: task.id, error: msg }, "senior_dev_pipeline_error");
    write("error", { message: msg });
    try {
      if (!seniorUnlimited) {
        await addCredits(
          user.id,
          SENIOR_DEV_BASE_COST,
          "senior_dev_refund",
          `Senior Dev Agent failed reservation refund for task ${task.id}`,
          `senior-dev-refund-${reservationId}`,
        );
      }
    } catch (refundErr: unknown) {
      logger.error(
        {
          taskId: task.id,
          error:
            refundErr instanceof Error
              ? refundErr.message
              : "Unknown refund error",
        },
        "senior_dev_refund_error",
      );
    }
    await updateSeniorDevTaskStatus(task.id, "failed");
  } finally {
    clearTimeout(timeout);
    clearInterval(heartbeat);
    if (!res.writableEnded) res.end();
  }
});

/** Resume Senior Dev Agent after plan approval */
router.post("/senior/:taskId/resume", async (req: Request, res: Response) => {
  const taskId = parseInt(req.params.taskId, 10);
  if (Number.isNaN(taskId)) {
    res.status(400).json({ error: "Invalid taskId" });
    return;
  }

  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const task = await getSeniorDevTaskById(taskId);
  if (!task || task.userId !== user.id) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  if (task.status !== "awaiting_approval") {
    res.status(400).json({ error: "Task not awaiting approval" });
    return;
  }

  const resumeCredits = await ensureUserCredits(user.id);
  const resumeUnlimited =
    !!resumeCredits.unlimited || resumeCredits.tier === "lifetime";
  if (!resumeUnlimited && resumeCredits.balance < 1) {
    res
      .status(402)
      .json(creditsExhaustedBody(resumeCredits.balance, 1, "resume this task"));
    return;
  }

  const claimed = await claimSeniorDevResume(task.id, user.id);
  if (!claimed) {
    res.status(409).json({
      error: "senior_dev_task_active",
      message:
        "This Senior Dev task has already been resumed or is no longer awaiting approval.",
    });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000);
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) {
      res.write(`event: ping\ndata: ${JSON.stringify({ t: Date.now() })}\n\n`);
    }
  }, 15000);

  req.on("close", () => {
    clearTimeout(timeout);
    clearInterval(heartbeat);
    controller.abort();
  });

  const write = (event: string, data: unknown) => {
    if (!res.writableEnded) {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  const onProgress = (e: ProgressEvent) => {
    if (controller.signal.aborted) return;
    write("progress", e);
  };

  try {
    const project = await getProjectById(task.projectId);
    const files =
      (project?.generatedFiles as Record<string, string> | null) ?? {};

    const result = await resumeAfterApproval(
      {
        id: task.id,
        projectId: task.projectId,
        userId: task.userId,
        request: task.request,
        mode: task.mode as "collaborative" | "autonomous",
        plan: task.plan as any,
        planApproved: true,
        status: "executing" as any,
        changes: (task.changes as any) ?? [],
        validationResults: (task.validationResult as any) ?? [],
        summary: task.summary ?? "",
        creditsSpent: task.creditsSpent ?? 0,
      },
      { ...files },
      project?.techStack || "react-node",
      onProgress,
    );

    if (project) {
      await updateProjectFiles(task.projectId, result.files);
    }

    await updateSeniorDevTask(task.id, {
      status: "completed",
      changes: result.changes,
      validationResult: result.validations,
      summary: result.summary,
      creditsSpent: task.creditsSpent ?? 0,
    });

    write("done", {
      status: "completed",
      summary: result.summary,
      filesChanged: result.changes.map((c) => c.path),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.error({ taskId: task.id, error: msg }, "senior_dev_resume_error");
    write("error", { message: msg });
    try {
      if (!resumeUnlimited) {
        await addCredits(
          user.id,
          SENIOR_DEV_BASE_COST,
          "senior_dev_refund",
          `Senior Dev Agent resume failed reservation refund for task ${task.id}`,
          `senior-dev-resume-refund-${task.id}`,
        );
      }
    } catch (refundErr: unknown) {
      logger.error(
        {
          taskId: task.id,
          error:
            refundErr instanceof Error
              ? refundErr.message
              : "Unknown refund error",
        },
        "senior_dev_resume_refund_error",
      );
    }
    await updateSeniorDevTask(task.id, {
      status: "failed",
      creditsSpent: 0,
    });
  } finally {
    clearTimeout(timeout);
    clearInterval(heartbeat);
    if (!res.writableEnded) res.end();
  }
});

router.post("/deploy", async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { projectId } = req.body as { projectId: number };
  if (!projectId) {
    res.status(400).json({ error: "projectId required" });
    return;
  }

  try {
    const project = await db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId),
    });
    if (!project || project.userId !== req.user.id) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const current = await db.query.buildSnapshots.findFirst({
      where: and(
        eq(schema.buildSnapshots.projectId, projectId),
        eq(schema.buildSnapshots.isCurrent, true),
      ),
    });
    if (!current) {
      res.status(400).json({ error: "No current build snapshot to deploy" });
      return;
    }

    const files = current.files as Record<string, string>;
    const deployUrl = await deployToVercel(
      project.title || "appforge-app",
      files,
    );

    watchProject(projectId, req.user.id, deployUrl);
    res.json({ success: true, deployUrl });
  } catch (err: any) {
    logger.error({ projectId, error: err?.message }, "deploy_error");
    res.status(500).json({ error: err?.message ?? "Deploy failed" });
  }
});

export default router;
export const buildRouter = router;