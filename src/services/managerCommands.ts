import { createHash } from "node:crypto";
import postgres from "postgres";
import { ENV } from "../_core/env.js";
export type ManagerCommandRecord = {
  userId: number;
  requestId: string;
  action: string;
  inputHash: string;
  input?: Record<string, unknown>;
  status: "executing" | "completed" | "failed";
  result?: any;
  error?: string;
  createdAt: string;
  execution?: { status: string; error?: string; updatedAt: string };
};
export type NewManagerCommand = {
  requestId: string;
  action: string;
  inputHash: string;
  input: Record<string, unknown>;
};
export interface ManagerCommandLedger {
  reserve(
    userId: number,
    input: NewManagerCommand,
    limit: number,
  ): Promise<{ fresh: boolean; record: ManagerCommandRecord }>;
  complete(userId: number, id: string, result: unknown): Promise<void>;
  fail(
    userId: number,
    id: string,
    error: string,
    uncertain?: boolean,
  ): Promise<void>;
  get(userId: number, id: string): Promise<ManagerCommandRecord | null>;
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [
          key,
          canonical((value as Record<string, unknown>)[key]),
        ]),
    );
  return value;
}
export function commandHash(action: string, input: Record<string, unknown>) {
  return createHash("sha256")
    .update(JSON.stringify({ action, input: canonical(input) }))
    .digest("hex");
}
export function managerBuildTitle(requestId: string, title: string) {
  return `Manager ${createHash("sha256").update(requestId).digest("hex").slice(0, 24)} ${title}`.slice(
    0,
    60,
  );
}
function record(row: any): ManagerCommandRecord {
  return {
    userId: row.user_id,
    requestId: row.request_id,
    action: row.action,
    inputHash: row.input_hash,
    input: row.input,
    status: row.status,
    result: row.result,
    error: row.error_code,
    createdAt: new Date(row.created_at).toISOString(),
    ...(row.execution_status
      ? {
          execution: {
            status: row.execution_status,
            error: row.execution_error || undefined,
            updatedAt: new Date(row.execution_updated_at).toISOString(),
          },
        }
      : {}),
  };
}
export function postgresManagerLedger(sql: postgres.Sql): ManagerCommandLedger {
  return {
    async reserve(userId, input, limit) {
      return sql.begin(async (tx) => {
        await tx`SELECT pg_advisory_xact_lock(hashtextextended(${`appforge-manager:${userId}`}, 0))`;
        const prior =
          await tx`SELECT * FROM appforge_manager_commands WHERE user_id=${userId} AND request_id=${input.requestId}`;
        if (prior[0]) {
          if (prior[0].input_hash !== input.inputHash)
            throw Error("manager_idempotency_conflict");
          return { fresh: false, record: record(prior[0]) };
        }
        const count =
          await tx`SELECT count(*)::integer AS total FROM appforge_manager_commands WHERE user_id=${userId} AND created_at>=now()-interval '24 hours'`;
        if (count[0].total >= limit) throw Error("manager_daily_limit_reached");
        const rows =
          await tx`INSERT INTO appforge_manager_commands(user_id,request_id,action,input_hash,input,status) VALUES (${userId},${input.requestId},${input.action},${input.inputHash},${tx.json(input.input as postgres.JSONValue)},'executing') RETURNING *`;
        return { fresh: true, record: record(rows[0]) };
      }) as Promise<{ fresh: boolean; record: ManagerCommandRecord }>;
    },
    async complete(userId, id, result) {
      await sql.begin(async (tx) => {
        const rows =
          await tx`UPDATE appforge_manager_commands SET status='completed', error_code=NULL, result=${tx.json(result as postgres.JSONValue)},updated_at=now() WHERE user_id=${userId} AND request_id=${id} AND status='executing' RETURNING action,input,result`;
        const row = rows[0];
        if (!row || !["repair", "approve_repair"].includes(row.action)) return;
        const taskId =
          row.action === "repair" ? row.result?.taskId : row.input?.taskId;
        if (!Number.isSafeInteger(taskId) || taskId <= 0)
          throw Error("manager_repair_identity_required");
        await tx`INSERT INTO appforge_manager_repair_queue(user_id,request_id,task_id,kind) VALUES (${userId},${id},${taskId},${row.action === "repair" ? "start" : "resume"}) ON CONFLICT(user_id,request_id) DO NOTHING`;
      });
    },
    async fail(userId, id, error, uncertain = false) {
      await sql`UPDATE appforge_manager_commands SET status=${uncertain ? "executing" : "failed"},error_code=${error},updated_at=now() WHERE user_id=${userId} AND request_id=${id} AND status='executing'`;
    },
    async get(userId, id) {
      const rows =
        await sql`SELECT c.*,q.status AS execution_status,q.error_code AS execution_error,q.updated_at AS execution_updated_at FROM appforge_manager_commands c LEFT JOIN appforge_manager_repair_queue q ON q.user_id=c.user_id AND q.request_id=c.request_id WHERE c.user_id=${userId} AND c.request_id=${id}`;
      return rows[0] ? record(rows[0]) : null;
    },
  };
}
let connection: postgres.Sql | undefined,
  ledger: ManagerCommandLedger | undefined;
export function managerCommandDatabase() {
  if (!ENV.databaseUrl) throw Error("manager_database_required");
  if (!connection)
    connection = postgres(ENV.databaseUrl, {
      max: 3,
      prepare: false,
      connect_timeout: 10,
      idle_timeout: 20,
    });
  return connection;
}
export function getManagerCommandLedger() {
  return (ledger ??= postgresManagerLedger(managerCommandDatabase()));
}
export async function closeManagerCommandLedger() {
  await connection?.end({ timeout: 5 });
  connection = undefined;
  ledger = undefined;
}
