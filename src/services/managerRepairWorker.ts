import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { managerCommandDatabase } from "./managerCommands.js";
import {
  startSeniorDevExecution,
  resumeSeniorDevExecution,
  settleSeniorDevExecution,
  SeniorDevExecutionError,
  type SeniorDevExecutionResult,
} from "./seniorDevExecution.js";
import { logger } from "../_core/logger.js";
export type ManagerRepairRunner = (
  input: { taskId: number; userId: number; reconcileOnly?: boolean },
  resume: boolean,
) => Promise<SeniorDevExecutionResult>;
const runRepair: ManagerRepairRunner = async (input, resume) => {
  const { getUserById, getSeniorDevTaskById } = await import("../db.js");
  const { isOwnerEmail } = await import("../lib/owner.js");
  const { getAccountLifecycleState } =
    await import("./accountLifecycleService.js");
  const { accountLifecycleAllowsAccess } =
    await import("../middleware/accountLifecycleAccess.js");
  const user = await getUserById(input.userId);
  if (
    !user ||
    user.isBanned ||
    !isOwnerEmail(user.email) ||
    !accountLifecycleAllowsAccess(await getAccountLifecycleState(input.userId))
  )
    throw new SeniorDevExecutionError("manager_company_identity_required", 403);
  // Task state is authoritative even if a crash preceded persisting the queue error.
  const task = await getSeniorDevTaskById(input.taskId);
  if (input.reconcileOnly || task?.status === "failed")
    return settleSeniorDevExecution(input);
  return (resume ? resumeSeniorDevExecution : startSeniorDevExecution)(input);
};
export async function managerRepairCycle(
  sql: postgres.Sql,
  userId: number,
  run: ManagerRepairRunner = runRepair,
) {
  const claimId = randomUUID();
  const rows = (await sql.begin(
    async (tx) =>
      tx`UPDATE appforge_manager_repair_queue SET status='running',claim_id=${claimId},lease_until=now()+interval '2 minutes',updated_at=now() WHERE (user_id,request_id)=(SELECT user_id,request_id FROM appforge_manager_repair_queue WHERE user_id=${userId} AND due_at<=now() AND (status='queued' OR (status='running' AND lease_until<now())) ORDER BY due_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,
  )) as any[];
  const job = rows[0];
  if (!job) return false;
  const heartbeat = setInterval(() => {
    void sql`UPDATE appforge_manager_repair_queue SET lease_until=now()+interval '2 minutes',updated_at=now() WHERE user_id=${userId} AND request_id=${job.request_id} AND claim_id=${claimId} AND status='running'`.catch(
      (error) => logger.error({ error }, "manager_repair_lease_failed"),
    );
  }, 30000);
  heartbeat.unref?.();
  try {
    const result = await run(
      {
        taskId: job.task_id,
        userId,
        ...(job.error_code === "senior_dev_refund_pending"
          ? { reconcileOnly: true }
          : {}),
      },
      job.kind === "resume",
    );
    await sql`UPDATE appforge_manager_repair_queue SET status=${result.status === "failed" ? "failed" : "completed"},error_code=${result.status === "failed" ? "senior_dev_failed" : null},lease_until=NULL,updated_at=now() WHERE user_id=${userId} AND request_id=${job.request_id} AND claim_id=${claimId}`;
  } catch (error) {
    // A live execution in another process is observed, never duplicated or marked failed by this worker.
    const active =
      error instanceof SeniorDevExecutionError &&
      [
        "senior_dev_task_active",
        "senior_dev_refund_pending",
        "build_runtime_unavailable",
      ].includes(error.code);
    const code =
      error instanceof SeniorDevExecutionError
        ? error.code
        : "manager_repair_execution_uncertain";
    await sql`UPDATE appforge_manager_repair_queue SET status=${active ? "queued" : "failed"},error_code=${code},due_at=now()+interval '30 seconds',lease_until=NULL,updated_at=now() WHERE user_id=${userId} AND request_id=${job.request_id} AND claim_id=${claimId}`;
  } finally {
    clearInterval(heartbeat);
  }
  return true;
}
export function startManagerRepairWorker(env = process.env) {
  let stopping = false,
    busy = false;
  let pending = Promise.resolve();
  const enabled = () =>
    Boolean(
      env.APPFORGE_MANAGER_TOKEN &&
      env.APPFORGE_MANAGER_TOKEN.length >= 32 &&
      (env.APPFORGE_MANAGER_SCOPES || "")
        .split(",")
        .map((s) => s.trim())
        .includes("repair") &&
      Number.isSafeInteger(Number(env.APPFORGE_MANAGER_DAILY_ACTION_LIMIT)) &&
      Number(env.APPFORGE_MANAGER_DAILY_ACTION_LIMIT) > 0 &&
      Number(env.APPFORGE_MANAGER_DAILY_ACTION_LIMIT) <= 1000 &&
      Number.isSafeInteger(Number(env.APPFORGE_MANAGER_USER_ID)) &&
      Number(env.APPFORGE_MANAGER_USER_ID) > 0,
    );
  const tick = () => {
    if (stopping || busy || !enabled()) return;
    busy = true;
    pending = managerRepairCycle(
      managerCommandDatabase(),
      Number(env.APPFORGE_MANAGER_USER_ID),
    )
      .then(
        () => {},
        (error) => logger.error({ error }, "manager_repair_cycle_failed"),
      )
      .finally(() => {
        busy = false;
      });
  };
  const timer = setInterval(tick, 3000);
  timer.unref?.();
  tick();
  return async () => {
    stopping = true;
    clearInterval(timer);
    await pending;
  };
}
