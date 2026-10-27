import {
  startSeniorDevExecution,
  resumeSeniorDevExecution,
  SeniorDevExecutionError,
} from "../services/seniorDevExecution.js";
import { Router, Request, Response } from "express";
import { db } from "../db.js";
import * as schema from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { deployProject } from "../services/deployer.js";
import { watchProject } from "../agents/selfHealing.js";
import {
  getBuildEventsSince,
  getLatestBuildClaimAt,
} from "../services/build-event-store.js";
import {
  currentBuildAttemptEvents,
  buildEventMatchesAttempt,
} from "../lib/buildRecovery.js";
import { subscribeRuntimeBuildEvents } from "../services/build-runtime.js";
import { subscribeBuildEvents } from "../services/build-queue.js";
import { getProjectById } from "../db.js";
import {
  parsePositiveIntParam,
  parsePositiveSafeInteger,
} from "../lib/httpParams.js";
import { logger } from "../_core/logger.js";
import { resolveProjectStack } from "../lib/projectStack.js";
import { manualDeployPreflight } from "../lib/stackDeployment.js";
const router = Router();

/** SSE endpoint that only streams the existing multi-agent pipeline. */
router.get("/:projectId", async (req: Request, res: Response) => {
  const projectId = parsePositiveIntParam(req.params.projectId);
  if (projectId === null) {
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
  if (
    ["validated", "production-certified"].includes(project.status ?? "") &&
    Object.keys(existingFiles).length > 0
  ) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    res.write(
      `event: done\ndata: ${JSON.stringify({
        status: project.status,
        buildStage: project.buildStage,
        outputMaturity: project.outputMaturity,
        projectId,
        fileCount: Object.keys(existingFiles).length,
        reused: true,
      })}\n\n`,
    );
    res.end();
    return;
  }

  if (project.status === "pending") {
    res.status(202).json({ projectId, status: project.status });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const claimedAt = await getLatestBuildClaimAt(projectId);
  let closed = false;
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) {
      res.write(`event: ping\ndata: ${JSON.stringify({ t: Date.now() })}\n\n`);
    }
  }, 15000);

  const write = (event: string, data: unknown) => {
    if (!buildEventMatchesAttempt(data, claimedAt)) return false;
    if (!closed && !res.writableEnded) {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
    return true;
  };

  const lastEventIdHeader = req.get("Last-Event-ID");
  const parsedLastEventId = Number.parseInt(lastEventIdHeader ?? "0", 10);
  const sinceEventId = Number.isFinite(parsedLastEventId)
    ? Math.max(0, parsedLastEventId)
    : 0;
  const historical = currentBuildAttemptEvents(
    await getBuildEventsSince(projectId, sinceEventId),
  );
  let sawTerminal = false;
  for (const row of historical) {
    if (!write(row.event, row.payload)) continue;
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
      if (!write(event, data)) return;
      if (event === "done" || event === "error") {
        closed = true;
        clearInterval(heartbeat);
        if (!res.writableEnded) res.end();
      }
    },
  );

  const unsubRedis = await subscribeBuildEvents(projectId, (event, data) => {
    if (!write(event, data)) return;
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

/** SSE is only a progress transport; the shared service owns execution and persisted heartbeats. */
async function streamSeniorDev(req: Request, res: Response, resume: boolean) {
  const taskId = parsePositiveIntParam(req.params.taskId);
  if (taskId === null)
    return void res.status(400).json({ error: "Invalid taskId" });
  if (!req.user)
    return void res.status(401).json({ error: "Not authenticated" });
  let disconnected = false;
  let ping: ReturnType<typeof setInterval> | undefined;
  const write = (event: string, data: unknown) => {
    if (!disconnected && !res.writableEnded)
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const started = () => {
    if (disconnected || res.headersSent) return;
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    ping = setInterval(() => write("ping", { t: Date.now() }), 15000);
  };
  res.on("close", () => {
    disconnected = true;
    clearInterval(ping);
  });
  try {
    const run = resume ? resumeSeniorDevExecution : startSeniorDevExecution;
    const result = await run({
      taskId,
      userId: req.user.id,
      onStarted: started,
      onProgress: (event) => write("progress", event),
    });
    started();
    write(
      result.status === "awaiting_approval" ? "awaiting_approval" : "done",
      result,
    );
  } catch (error) {
    const code =
      error instanceof SeniorDevExecutionError
        ? error.code
        : resume
          ? "senior_dev_resume_failed"
          : "senior_dev_failed";
    const status =
      error instanceof SeniorDevExecutionError ? error.status : 503;
    const body = {
      error: code,
      message: resume
        ? "Senior Dev could not resume this task."
        : "Senior Dev could not complete this task.",
    };
    if (!disconnected && !res.writableEnded) {
      if (res.headersSent) write("error", body);
      else res.status(status).json(body);
    }
  } finally {
    clearInterval(ping);
    if (!disconnected && !res.writableEnded) res.end();
  }
}
router.get("/senior/:taskId", (req, res) => {
  void streamSeniorDev(req, res, false);
});
router.post("/senior/:taskId/resume", (req, res) => {
  void streamSeniorDev(req, res, true);
});

router.post("/deploy", async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const projectId = parsePositiveSafeInteger(
    (req.body as { projectId?: unknown })?.projectId,
  );
  if (projectId === null) {
    res.status(400).json({ error: "Valid projectId required" });
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

    // Same stack rules as every other deploy path: structural-only stacks are
    // never deployed, the destination must be one the stack supports, and the
    // canonical contract gates completeness inside deployProject.
    const { techStack, productContract } = resolveProjectStack(project);
    const preflight = manualDeployPreflight(techStack, "vercel");
    if (!preflight.ok) {
      res
        .status(preflight.status)
        .json({ error: preflight.error, message: preflight.message });
      return;
    }
    if (!productContract) {
      res.status(409).json({
        error: "product_contract_required",
        message:
          "This project has no canonical product contract, so it cannot be deployed. Rebuild it first.",
      });
      return;
    }

    const files = current.files as Record<string, string>;
    const { url: deployUrl } = await deployProject({
      destination: "vercel",
      projectName: project.title || "appforge-app",
      files,
      projectId,
      techStack,
      productContract,
      productPlan: project.productPlan ?? undefined,
    });

    watchProject(projectId, req.user.id, deployUrl);
    res.json({ success: true, deployUrl });
  } catch (err: unknown) {
    logger.error({ projectId, error: err }, "deploy_error");
    res.status(500).json({ error: "Deploy failed" });
  }
});

export default router;
export const buildRouter = router;
