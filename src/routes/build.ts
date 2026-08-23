import { Router, Request, Response } from "express";
import { db } from "../db.js";
import * as schema from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { deployToVercel } from "../services/deployer.js";
import { watchProject } from "../agents/selfHealing.js";
import { runAgentPipeline } from "../agents/pipeline.js";
import {
  getProjectById,
  updateProjectStatus,
  pauseProject,
  resumeProject,
  ensureUserCredits,
  deductCredits,
  getUserCredits,
  updateProjectFiles,
  getSeniorDevTaskById,
  updateSeniorDevTask,
  updateSeniorDevTaskStatus,
} from "../db.js";
import { runSeniorDevAgent, resumeAfterApproval, type ProgressEvent } from "../agents/seniorDevAgent.js";
import { logger } from "../_core/logger.js";

const router = Router();

const BUILD_COST = 5;
const PLANNER_COST = 2;
const CODER_COST = 3;
const REVIEWER_COST = 1;

const SENIOR_DEV_BASE_COST = 6;

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

  // Credit check
  const credits = await ensureUserCredits(user.id);
  if (credits.balance < BUILD_COST && credits.monthlyAllowance <= 0) {
    res.status(402).json({
      error: "Insufficient credits",
      balance: credits.balance,
      cost: BUILD_COST,
      message: "Purchase credits or upgrade your plan to continue building.",
    });
    return;
  }

  // Reserve credits upfront
  if (credits.balance >= BUILD_COST) {
    await deductCredits(user.id, BUILD_COST, projectId, "Build reservation");
  } else {
    // Fall back to monthly allowance (free tier)
    // This is tracked via countBuildsThisMonth in the router, not credits
  }

  // Resume if previously paused
  if (project.status === "paused" && project.pauseReason === "credits_exhausted") {
    await resumeProject(projectId);
  }

  await updateProjectStatus(projectId, "running");

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 min max

  req.on("close", () => {
    clearTimeout(timeout);
    controller.abort();
  });

  const write = (event: string, data: unknown) => {
    if (!res.writableEnded) {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  // Credit-aware pipeline wrapper
  let totalSpent = 0;
  const creditAwareWrite = (event: string, data: any) => {
    // Deduct credits per agent phase
    if (event === "agent" && data?.type === "start") {
      const agent = data?.payload?.agent as string;
      let phaseCost = 0;
      if (agent === "Planner") phaseCost = PLANNER_COST;
      if (agent === "Coder") phaseCost = CODER_COST;
      if (agent === "Reviewer") phaseCost = REVIEWER_COST;

      if (phaseCost > 0) {
        totalSpent += phaseCost;
      }
    }
    write(event, data);
  };

  // Check if we need to pause mid-build
  const checkCredits = async () => {
    const current = await getUserCredits(user.id);
    if (current && current.balance < 1) {
      // Out of credits — pause the project
      await pauseProject(projectId, "credits_exhausted");
      write("pause", {
        reason: "credits_exhausted",
        message: "Build paused: your credits ran out. Purchase more to resume.",
        spent: totalSpent,
      });
      return false; // signal to stop
    }
    return true;
  };

  try {
    // Check initial credits
    const ok = await checkCredits();
    if (!ok) {
      res.end();
      return;
    }

    await runAgentPipeline(
      projectId,
      project.description || "",
      project.techStack || "react-node",
      creditAwareWrite,
      controller.signal,
      checkCredits
    );

    // Update final credit spend
    if (totalSpent > 0) {
      const { updateProjectCreditsSpent } = await import("../db.js");
      await updateProjectCreditsSpent(projectId, totalSpent);
    }

    write("done", { status: "completed" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Build pipeline error:", msg);
    write("error", { message: msg });
  } finally {
    clearTimeout(timeout);
    if (!res.writableEnded) res.end();
  }
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

  // Credit check
  const credits = await ensureUserCredits(user.id);
  if (credits.balance < SENIOR_DEV_BASE_COST && credits.monthlyAllowance <= 0) {
    res.status(402).json({
      error: "Insufficient credits",
      balance: credits.balance,
      cost: SENIOR_DEV_BASE_COST,
      message: "Purchase credits or upgrade your plan to use the Senior Dev Agent.",
    });
    return;
  }

  // Reserve base cost
  await deductCredits(user.id, SENIOR_DEV_BASE_COST, task.projectId, "Senior Dev Agent reservation");

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000);

  req.on("close", () => {
    clearTimeout(timeout);
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
    const files = (project.generatedFiles as Record<string, string> | null) ?? {};

    const result = await runSeniorDevAgent(
      {
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
      },
      { ...files },
      project.techStack || "react-node",
      onProgress
    );

    // Save updated files back to project
    if (Object.keys(result.files).length > 0) {
      await updateProjectFiles(task.projectId, result.files);
    }

    // Update task record
    await updateSeniorDevTask(task.id, {
      status: "completed",
      changes: result.changes,
      validationResult: result.validations,
      summary: result.summary,
      creditsSpent: result.changes.length * 3 + 2 + 2, // rough actual spend
    });

    write("done", {
      status: "completed",
      summary: result.summary,
      filesChanged: result.changes.map(c => c.path),
      creditsSpent: task.creditsSpent,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.error({ taskId: task.id, error: msg }, "senior_dev_pipeline_error");
    write("error", { message: msg });
    await updateSeniorDevTaskStatus(task.id, "failed");
  } finally {
    clearTimeout(timeout);
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

  // Start SSE response
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000);

  req.on("close", () => {
    clearTimeout(timeout);
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
    const files = (project?.generatedFiles as Record<string, string> | null) ?? {};

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
      onProgress
    );

    if (project) {
      await updateProjectFiles(task.projectId, result.files);
    }

    await updateSeniorDevTask(task.id, {
      status: "completed",
      changes: result.changes,
      validationResult: result.validations,
      summary: result.summary,
      creditsSpent: task.creditsSpent,
    });

    write("done", {
      status: "completed",
      summary: result.summary,
      filesChanged: result.changes.map(c => c.path),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.error({ taskId: task.id, error: msg }, "senior_dev_resume_error");
    write("error", { message: msg });
    await updateSeniorDevTaskStatus(task.id, "failed");
  } finally {
    clearTimeout(timeout);
    if (!res.writableEnded) res.end();
  }
});

// ── Deploy + Auto-Heal Watch ──
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
      where: and(eq(schema.buildSnapshots.projectId, projectId), eq(schema.buildSnapshots.isCurrent, true)),
    });
    if (!current) {
      res.status(400).json({ error: "No current build snapshot to deploy" });
      return;
    }

    const files = current.files as Record<string, string>;
    const deployUrl = await deployToVercel(project.title || "appforge-app", files);

    // Start self-healing watcher for this deployment
    watchProject(projectId, req.user.id, deployUrl);

    res.json({ success: true, deployUrl });
  } catch (err: any) {
    logger.error({ projectId, error: err?.message }, "deploy_error");
    res.status(500).json({ error: err?.message ?? "Deploy failed" });
  }
});

export default router;
export const buildRouter = router;