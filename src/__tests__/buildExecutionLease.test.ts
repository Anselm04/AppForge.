import { beforeEach, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import * as schema from "../db/schema.js";
import {
  BuildExecutionLeaseLostError,
  createBuildExecutionDatabase,
  registerBuildLeaseAbort,
  withBuildExecutionLease,
} from "../services/buildExecutionLease.js";

const job = { projectId: 41, userId: 7, createdAt: "2026-10-04T00:01:00Z" };
let epoch = 0;
let claimedAt: string | null;
let status = "running";
let writes: Array<Record<string, unknown>>;
let transactions = 0;
function builder(kind: string) {
  let data: unknown;
  const execute = async () => {
    writes.push({ kind, data });
    return [{ id: 41 }];
  };
  const value = {
    set(input: unknown) {
      data = input;
      return value;
    },
    values(input: unknown) {
      data = input;
      return value;
    },
    where() {
      return value;
    },
    returning() {
      return value;
    },
    execute,
    then(
      resolve: (result: unknown) => unknown,
      reject: (error: unknown) => unknown,
    ) {
      return execute().then(resolve, reject);
    },
  };
  return value;
}
const native = {
  async execute(query: Parameters<PgDialect["sqlToQuery"]>[0]) {
    const text = new PgDialect().sqlToQuery(query).sql;
    if (text.includes("FOR UPDATE")) return [{ id: 41, userId: 7, status }];
    if (
      text.includes("INSERT INTO build_events") &&
      text.includes("'build_execution_claim'")
    )
      return [{ id: ++epoch }];
    if (text.includes("'build_execution_claim'")) return [{ id: epoch }];
    if (text.includes("'build_claim'")) return claimedAt ? [{ claimedAt }] : [];
    writes.push({ kind: "raw", text });
    return [];
  },
  update: () => builder("update"),
  insert: () => builder("insert"),
  delete: () => builder("delete"),
  async transaction(callback: (tx: unknown) => Promise<unknown>) {
    transactions++;
    return callback(native);
  },
};
const db = createBuildExecutionDatabase(
  native as unknown as Parameters<typeof createBuildExecutionDatabase>[0],
);
beforeEach(() => {
  epoch = 0;
  claimedAt = null;
  status = "running";
  writes = [];
  transactions = 0;
});

it("preserves ordinary database writes outside build execution", async () => {
  await db
    .update(schema.projects)
    .set({ title: "owner edit" })
    .where(sql`id=41`)
    .returning();
  expect(writes).toEqual([{ kind: "update", data: { title: "owner edit" } }]);
  expect(transactions).toBe(0);
});
it("lets the current worker persist artifacts and raw evidence", async () => {
  await withBuildExecutionLease(job, async () => {
    await db
      .update(schema.projects)
      .set({ title: "current files" })
      .returning();
    await db.execute(sql`INSERT INTO build_events (project_id) VALUES (41)`);
  });
  expect(writes.map((w) => w.kind)).toEqual(["update", "raw"]);
});
it("rejects a late artifact query created by an old worker after another worker takes over", async () => {
  const abort = vi.fn();
  await withBuildExecutionLease(job, async () => {
    registerBuildLeaseAbort(abort);
    const oldSave = db
      .update(schema.projects)
      .set({ title: "stale files" })
      .returning();
    await withBuildExecutionLease(job, async () => {
      await db
        .update(schema.projects)
        .set({ title: "replacement files" })
        .returning();
    });
    await expect(oldSave).rejects.toBeInstanceOf(BuildExecutionLeaseLostError);
    await expect(
      db.execute(sql`INSERT INTO build_events (project_id) VALUES (41)`),
    ).rejects.toBeInstanceOf(BuildExecutionLeaseLostError);
  });
  expect(writes).toEqual([
    { kind: "update", data: { title: "replacement files" } },
  ]);
  expect(abort).toHaveBeenCalled();
});
it("blocks old writes as soon as a newer starter claims the project, before its worker starts", async () => {
  await withBuildExecutionLease(job, async () => {
    claimedAt = "2026-10-04T00:02:00Z";
    await expect(
      db.delete(schema.projects).where(sql`id=41`),
    ).rejects.toBeInstanceOf(BuildExecutionLeaseLostError);
  });
  expect(writes).toEqual([]);
});
it("blocks a worker revoked by terminal queue recovery", async () => {
  await withBuildExecutionLease(job, async () => {
    epoch++;
    await expect(
      db.insert(schema.projects).values({ userId: 7, title: "stale snapshot" }),
    ).rejects.toBeInstanceOf(BuildExecutionLeaseLostError);
  });
  expect(writes).toEqual([]);
});
it("checks an explicit transaction once and preserves nested database writes in that transaction", async () => {
  await withBuildExecutionLease(job, async () => {
    const initial = transactions;
    await db.transaction(async (tx) => {
      await tx.update(schema.projects).set({ title: "saved" });
      await db.insert(schema.projects).values({ userId: 7, title: "snapshot" });
      await db.execute(sql`INSERT INTO build_events (project_id) VALUES (41)`);
    });
    expect(transactions - initial).toBe(1);
  });
  expect(writes.map((w) => w.kind)).toEqual(["update", "insert", "raw"]);
});
it("guards explicit builder execution as well as awaited builders", async () => {
  await withBuildExecutionLease(job, async () => {
    await db.update(schema.projects).set({ title: "current" }).execute();
    epoch++;
    await expect(
      db.update(schema.projects).set({ title: "stale" }).execute(),
    ).rejects.toBeInstanceOf(BuildExecutionLeaseLostError);
  });
  expect(writes).toEqual([{ kind: "update", data: { title: "current" } }]);
});
it("refuses to acquire a worker lease for a paused or replaced attempt", async () => {
  status = "paused";
  await expect(
    withBuildExecutionLease(job, async () => undefined),
  ).rejects.toBeInstanceOf(BuildExecutionLeaseLostError);
  status = "running";
  claimedAt = "2026-10-04T00:02:00Z";
  await expect(
    withBuildExecutionLease(job, async () => undefined),
  ).rejects.toBeInstanceOf(BuildExecutionLeaseLostError);
  expect(epoch).toBe(0);
});
