import { assertBuildExecutionReady } from "./buildExecutionReadiness.js";
import { randomUUID } from "node:crypto";
import {
  getSeniorDevTaskById,
  getProjectById,
  ensureUserCredits,
  deductCredits,
  updateSeniorDevTask,
  getEditableProjectFiles,
} from "../db.js";
import { commitValidatedProjectFilesEdit } from "./projectFileEdits.js";
import {
  runSeniorDevAgent,
  resumeAfterApproval,
  type ProgressEvent,
  type SeniorDevTask,
} from "../agents/seniorDevAgent.js";
import {
  claimSeniorDevStart,
  claimSeniorDevResume,
  releaseSeniorDevStartClaim,
  failStaleSeniorDevExecution,
  touchSeniorDevExecution,
} from "./senior-dev-claim.js";
import {
  refundOutstandingSeniorDevReservation,
  wasSeniorDevReservationCharged,
} from "./senior-dev-reservation.js";
import { resolveProjectStack } from "../lib/projectStack.js";
import { SENIOR_DEV_CREDIT_COST } from "../lib/credits.js";
import { logger } from "../_core/logger.js";
const SENIOR_DEV_BASE_COST = SENIOR_DEV_CREDIT_COST;
const SENIOR_DEV_STALE_AFTER_MS = 10 * 60 * 1000;
export type SeniorDevExecutionInput = {
  taskId: number;
  userId: number;
  onProgress?: (event: ProgressEvent) => void;
  onStarted?: () => void;
};
export type SeniorDevExecutionResult = {
  status: "completed" | "failed" | "awaiting_approval";
  summary: string;
  creditsSpent: number;
  filesChanged?: string[];
  plan?: unknown;
  reused?: boolean;
};
export class SeniorDevExecutionError extends Error {
  status: number;
  code: string;
  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}
async function settleOutstandingSeniorDevReservation(
  userId: number,
  projectId: number,
  taskId: number,
  reason: string,
) {
  if (!(await wasSeniorDevReservationCharged(userId, projectId, taskId)))
    return true;
  try {
    await refundOutstandingSeniorDevReservation(
      userId,
      projectId,
      taskId,
      reason,
    );
    return true;
  } catch (error) {
    logger.error(
      { taskId, userId, error },
      "senior_dev_reservation_settlement_failed",
    );
    return false;
  }
}
async function executionReady() {
  try {
    await assertBuildExecutionReady();
  } catch {
    throw new SeniorDevExecutionError("build_runtime_unavailable", 503);
  }
}
async function owned(input: SeniorDevExecutionInput) {
  const task = await getSeniorDevTaskById(input.taskId);
  if (!task || task.userId !== input.userId)
    throw new SeniorDevExecutionError("senior_dev_task_not_found", 404);
  const project = await getProjectById(task.projectId);
  if (!project || project.userId !== input.userId)
    throw new SeniorDevExecutionError("senior_dev_project_not_found", 404);
  return { task, project };
}
async function reconcileActiveExecution(
  task: NonNullable<Awaited<ReturnType<typeof getSeniorDevTaskById>>>,
  user: { id: number },
): Promise<never> {
  const recovered = await failStaleSeniorDevExecution(
    task.id,
    user.id,
    new Date(Date.now() - SENIOR_DEV_STALE_AFTER_MS),
  );
  if (!recovered)
    throw new SeniorDevExecutionError("senior_dev_task_active", 409);
  const settled = await settleOutstandingSeniorDevReservation(
    user.id,
    task.projectId,
    task.id,
    `Senior Dev stale execution refund for task ${task.id}`,
  );
  throw new SeniorDevExecutionError(
    settled
      ? "senior_dev_stale_execution_recovered"
      : "senior_dev_refund_pending",
    settled ? 409 : 503,
  );
}
export async function settleSeniorDevExecution(
  input: SeniorDevExecutionInput,
): Promise<SeniorDevExecutionResult> {
  const { task } = await owned(input);
  const user = { id: input.userId };
  if (task.status === "completed")
    return {
      status: "completed",
      summary: task.summary || "",
      creditsSpent: task.creditsSpent || 0,
      reused: true,
    };
  if (task.status === "executing") return reconcileActiveExecution(task, user);
  if (
    !(await settleOutstandingSeniorDevReservation(
      user.id,
      task.projectId,
      task.id,
      `Senior Dev interrupted execution settlement for task ${task.id}`,
    ))
  )
    throw new SeniorDevExecutionError("senior_dev_refund_pending", 503);
  return {
    status: "failed",
    summary:
      "Reservation settled. Inspect interrupted execution before starting a new repair.",
    creditsSpent: 0,
  };
}
async function executeClaimed(
  input: SeniorDevExecutionInput,
  task: NonNullable<Awaited<ReturnType<typeof getSeniorDevTaskById>>>,
  project: NonNullable<Awaited<ReturnType<typeof getProjectById>>>,
  resume: boolean,
): Promise<SeniorDevExecutionResult> {
  const user = { id: input.userId };
  // Execution owns its heartbeat. Closing an HTTP connection must not imply that provider work stopped.
  const executionHeartbeat = setInterval(() => {
    void touchSeniorDevExecution(task.id, user.id).catch((error) =>
      logger.error(
        { taskId: task.id, error },
        "senior_dev_execution_heartbeat_failed",
      ),
    );
  }, 30000);
  executionHeartbeat.unref?.();
  try {
    try {
      input.onStarted?.();
    } catch {
      /* Transport failure cannot cancel provider work. */
    }
    const context = resolveProjectStack(project);
    const agentTask: SeniorDevTask = {
      id: task.id,
      projectId: task.projectId,
      userId: task.userId,
      request: task.request,
      mode: task.mode as "collaborative" | "autonomous",
      plan: task.plan as any,
      planApproved: resume || task.planApproved === true,
      status: resume ? "executing" : (task.status as any),
      changes: (task.changes as any) || [],
      validationResults: (task.validationResult as any) || [],
      summary: task.summary || "",
      creditsSpent: task.creditsSpent || 0,
      productContract: context.productContract,
    };
    const progress = (event: ProgressEvent) => {
      try {
        input.onProgress?.(event);
      } catch {
        /* A transport listener cannot fail execution. */
      }
    };
    const run = resume ? resumeAfterApproval : runSeniorDevAgent;
    // Start from the customer's latest saved working revision.
    const originalFiles = await getEditableProjectFiles(task.projectId);
    const result = await run(
      agentTask,
      { ...originalFiles },
      context.techStack,
      progress,
    );
    if (agentTask.status === "awaiting_approval") {
      await updateSeniorDevTask(task.id, {
        status: "awaiting_approval",
        plan: agentTask.plan,
        planApproved: false,
        summary: result.summary,
        creditsSpent: agentTask.creditsSpent,
      });
      return {
        status: "awaiting_approval",
        summary: result.summary,
        plan: agentTask.plan,
        creditsSpent: agentTask.creditsSpent,
      };
    }
    const failed = agentTask.status === "failed";
    if (!failed && Object.keys(result.files).length) {
      // Reject results produced against a stale version, preserving edits the
      // customer made while the AI task was running.
      await commitValidatedProjectFilesEdit({
        project,
        userId: user.id,
        files: result.files,
        originalFiles,
        label: "Senior Dev task " + task.id,
        validationResult: result.validations,
      });
    }
    if (failed)
      await refundOutstandingSeniorDevReservation(
        user.id,
        task.projectId,
        task.id,
        `Senior Dev Agent ${resume ? "resume " : ""}failed reservation refund for task ${task.id}`,
      );
    await updateSeniorDevTask(task.id, {
      status: failed ? "failed" : "completed",
      plan: agentTask.plan,
      planApproved: agentTask.planApproved,
      changes: result.changes,
      validationResult: result.validations,
      summary: result.summary,
      creditsSpent: failed ? 0 : agentTask.creditsSpent,
    });
    return {
      status: failed ? "failed" : "completed",
      summary: result.summary,
      filesChanged: failed ? [] : result.changes.map((c) => c.path),
      creditsSpent: failed ? 0 : agentTask.creditsSpent,
    };
  } catch (error) {
    logger.error(
      { taskId: task.id, error },
      resume ? "senior_dev_resume_error" : "senior_dev_pipeline_error",
    );
    let refundPending = false;
    try {
      await refundOutstandingSeniorDevReservation(
        user.id,
        task.projectId,
        task.id,
        `Senior Dev Agent ${resume ? "resume " : ""}failed reservation refund for task ${task.id}`,
      );
    } catch (refundError) {
      refundPending = true;
      logger.error(
        { taskId: task.id, error: refundError },
        resume ? "senior_dev_resume_refund_error" : "senior_dev_refund_error",
      );
    }
    await updateSeniorDevTask(task.id, { status: "failed", creditsSpent: 0 });
    throw new SeniorDevExecutionError(
      refundPending
        ? "senior_dev_refund_pending"
        : resume
          ? "senior_dev_resume_failed"
          : "senior_dev_failed",
      503,
    );
  } finally {
    clearInterval(executionHeartbeat);
  }
}
export async function startSeniorDevExecution(
  input: SeniorDevExecutionInput,
): Promise<SeniorDevExecutionResult> {
  const { task, project } = await owned(input);
  const user = { id: input.userId };
  if (["completed", "awaiting_approval"].includes(task.status || ""))
    return {
      status: task.status as "completed" | "awaiting_approval",
      summary: task.summary || "",
      creditsSpent: task.creditsSpent || 0,
      plan: task.plan,
      reused: true,
    };
  if (task.status === "executing") return reconcileActiveExecution(task, user);
  if (
    task.status === "failed" &&
    !(await settleOutstandingSeniorDevReservation(
      user.id,
      task.projectId,
      task.id,
      `Senior Dev retry preflight refund for task ${task.id}`,
    ))
  )
    throw new SeniorDevExecutionError("senior_dev_refund_pending", 503);
  await executionReady();
  const credits = await ensureUserCredits(user.id);
  const seniorUnlimited = !!credits.unlimited || credits.tier === "lifetime";
  if (!seniorUnlimited && credits.balance < SENIOR_DEV_BASE_COST)
    throw new SeniorDevExecutionError("credits_exhausted", 402);
  const claimed = await claimSeniorDevStart(task.id, user.id);
  if (!claimed)
    throw new SeniorDevExecutionError("senior_dev_task_active", 409);
  const reservationId = `senior-dev-${task.id}-${randomUUID()}`;
  if (!seniorUnlimited) {
    try {
      await deductCredits(
        user.id,
        SENIOR_DEV_BASE_COST,
        task.projectId,
        `Senior Dev Agent reservation ${reservationId}`,
      );
    } catch (error) {
      await releaseSeniorDevStartClaim(task.id, user.id, task.status);
      logger.error(
        { taskId: task.id, error },
        "senior_dev_start_charge_failed",
      );
      throw new SeniorDevExecutionError("senior_dev_start_failed", 503);
    }
  }
  return executeClaimed(input, task, project, false);
}
export async function resumeSeniorDevExecution(
  input: SeniorDevExecutionInput,
): Promise<SeniorDevExecutionResult> {
  const { task, project } = await owned(input);
  const user = { id: input.userId };
  if (task.status === "completed")
    return {
      status: "completed",
      summary: task.summary || "",
      creditsSpent: task.creditsSpent || 0,
      reused: true,
    };
  if (task.status === "executing") return reconcileActiveExecution(task, user);
  // A crash may precede the queue error update; failed task state itself requires settlement.
  if (task.status === "failed") return settleSeniorDevExecution(input);
  if (task.status !== "awaiting_approval")
    throw new SeniorDevExecutionError("senior_dev_not_awaiting_approval", 409);
  await executionReady();
  if (!(await claimSeniorDevResume(task.id, user.id)))
    throw new SeniorDevExecutionError("senior_dev_task_active", 409);
  // Initial planning already reserved credits. Resume never charges or checks the balance again.
  return executeClaimed(input, task, project, true);
}
