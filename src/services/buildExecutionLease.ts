import { AsyncLocalStorage } from "node:async_hooks";
import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "../db/schema.js";

type Database = PostgresJsDatabase<typeof schema>;
type Lease = {
  projectId: number;
  userId: number;
  createdAt: string;
  executionId: number;
  abort?: (error: Error) => void;
  revoked?: boolean;
};
const leases = new AsyncLocalStorage<Lease>();
const transactions = new AsyncLocalStorage<Database>();
let baseDatabase: Database | undefined;

export class BuildExecutionLeaseLostError extends Error {
  constructor() {
    super("This worker no longer owns the current build attempt.");
    this.name = "BuildExecutionLeaseLostError";
  }
}

export function currentBuildExecutionLease(): Readonly<Lease> | undefined {
  return leases.getStore();
}

export function registerBuildLeaseAbort(handler: (error: Error) => void): void {
  const lease = leases.getStore();
  if (lease) lease.abort = handler;
}

function revoke(lease: Lease): never {
  lease.revoked = true;
  const error = new BuildExecutionLeaseLostError();
  lease.abort?.(error);
  throw error;
}

async function lockProject(tx: Database, projectId: number) {
  const rows = await tx.execute(sql`
    SELECT id, user_id AS "userId", status FROM projects
    WHERE id = ${projectId} FOR UPDATE
  `);
  return (
    rows as unknown as Array<{ id: number; userId: number; status: string }>
  )[0];
}

async function newerClaim(
  tx: Database,
  projectId: number,
  createdAt: string,
): Promise<boolean> {
  const rows = await tx.execute(sql`
    SELECT payload->>'claimedAt' AS "claimedAt" FROM build_events
    WHERE project_id = ${projectId} AND event = 'build_claim'
    ORDER BY id DESC LIMIT 1
  `);
  const claimedAt = (rows as unknown as Array<{ claimedAt: string }>)[0]
    ?.claimedAt;
  return (
    !Number.isFinite(Date.parse(createdAt)) ||
    Boolean(
      claimedAt &&
      (!Number.isFinite(Date.parse(claimedAt)) ||
        Date.parse(claimedAt) > Date.parse(createdAt)),
    )
  );
}

async function checkLease(tx: Database, lease: Lease): Promise<void> {
  const project = await lockProject(tx, lease.projectId);
  if (!project || project.userId !== lease.userId) revoke(lease);
  const rows = await tx.execute(sql`
    SELECT id FROM build_events WHERE project_id = ${lease.projectId}
    AND event = 'build_execution_claim' ORDER BY id DESC LIMIT 1
  `);
  if (
    (rows as unknown as Array<{ id: number }>)[0]?.id !== lease.executionId ||
    (await newerClaim(tx, lease.projectId, lease.createdAt))
  )
    revoke(lease);
}

async function guarded<T>(
  lease: Lease,
  operation: (tx: Database) => Promise<T>,
): Promise<T> {
  if (lease.revoked) revoke(lease);
  const active = transactions.getStore();
  if (active && leases.getStore() === lease) return operation(active);
  if (!baseDatabase) throw new Error("Build database is unavailable");
  return baseDatabase.transaction(async (transaction) => {
    const tx = transaction as unknown as Database;
    await checkLease(tx, lease);
    return leases.run(lease, () => transactions.run(tx, () => operation(tx)));
  });
}

export async function assertCurrentBuildLease(): Promise<void> {
  const lease = leases.getStore();
  if (lease) await guarded(lease, async () => undefined);
}

export async function withBuildExecutionLease<T>(
  job: { projectId: number; userId: number; createdAt: string },
  operation: () => Promise<T>,
): Promise<T> {
  if (!baseDatabase) throw new Error("Build database is unavailable");
  const executionId = await baseDatabase.transaction(async (transaction) => {
    const tx = transaction as unknown as Database;
    const project = await lockProject(tx, job.projectId);
    if (
      !project ||
      project.userId !== job.userId ||
      project.status !== "running" ||
      (await newerClaim(tx, job.projectId, job.createdAt))
    )
      throw new BuildExecutionLeaseLostError();
    const rows = await tx.execute(sql`
      INSERT INTO build_events (project_id, event, payload)
      VALUES (${job.projectId}, 'build_execution_claim', ${JSON.stringify({ createdAt: job.createdAt })}::jsonb)
      RETURNING id
    `);
    const id = (rows as unknown as Array<{ id: number }>)[0]?.id;
    if (!Number.isSafeInteger(id) || id <= 0)
      throw new Error("Build execution claim was not persisted");
    return id;
  });
  return leases.run({ ...job, executionId }, operation);
}

type MethodCall = { method: PropertyKey; args: unknown[] };
function invoke(target: object, method: PropertyKey, args: unknown[]): unknown {
  const fn = Reflect.get(target, method) as (...values: unknown[]) => unknown;
  return fn.apply(target, args);
}

/** All existing build writes, including snapshots and evidence, share one fence. */
export function createBuildExecutionDatabase(database: Database): Database {
  baseDatabase = database;
  function wrapBuilder(
    target: object,
    lease: Lease,
    calls: MethodCall[],
  ): object {
    const execute = (extra: MethodCall[] = []) =>
      guarded(lease, async (tx) => {
        let query: unknown = tx;
        for (const call of [...calls, ...extra])
          query = invoke(query as object, call.method, call.args);
        return await query;
      });
    return new Proxy(target, {
      get(builder, key) {
        if (key === "then")
          return (
            resolve: (value: unknown) => unknown,
            reject: (error: unknown) => unknown,
          ) => execute().then(resolve, reject);
        if (key === "catch")
          return (reject: (error: unknown) => unknown) =>
            execute().catch(reject);
        if (key === "finally")
          return (done: () => void) => execute().finally(done);
        if (key === "execute")
          return (...args: unknown[]) => execute([{ method: key, args }]);
        const value = Reflect.get(builder, key);
        if (typeof value !== "function") return value;
        if (
          typeof key === "symbol" ||
          ["getSQL", "toSQL", "shouldOmitSQLParens"].includes(String(key))
        )
          return value.bind(builder);
        if (["iterator", "stream"].includes(String(key)))
          return () => {
            throw new Error("Streaming build mutations are not supported");
          };
        return (...args: unknown[]) => {
          const next = value.apply(builder, args) as unknown;
          return next && typeof next === "object"
            ? wrapBuilder(next, lease, [...calls, { method: key, args }])
            : next;
        };
      },
    });
  }
  return new Proxy(database, {
    get(defaultDb, key) {
      const lease = leases.getStore();
      const tx = transactions.getStore();
      const current = tx ?? defaultDb;
      const value = Reflect.get(current, key);
      if (!lease || tx)
        return typeof value === "function" ? value.bind(current) : value;
      if (key === "execute")
        return (...args: unknown[]) =>
          guarded(lease, async (fenced) => await invoke(fenced, key, args));
      if (key === "transaction")
        return (callback: (transaction: Database) => Promise<unknown>) =>
          guarded(lease, callback);
      if (["insert", "update", "delete"].includes(String(key)))
        return (...args: unknown[]) =>
          wrapBuilder(invoke(defaultDb, key, args) as object, lease, [
            { method: key, args },
          ]);
      return typeof value === "function" ? value.bind(current) : value;
    },
  });
}

/** Agent text is audit-only; never use this path for files, evidence or status. */
export async function appendBuildAgentLog(
  projectId: number,
  payload: unknown,
): Promise<void> {
  const lease = leases.getStore();
  if (!baseDatabase) throw new Error("Build database is unavailable");
  if (lease && (lease.projectId !== projectId || lease.revoked)) revoke(lease);
  await baseDatabase.execute(sql`INSERT INTO build_events (project_id, event, payload)
    VALUES (${projectId}, 'agent', ${JSON.stringify(payload)}::jsonb)`);
}
