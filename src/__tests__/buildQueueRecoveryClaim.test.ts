import { beforeEach, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const io = vi.hoisted(() => ({
  set: vi.fn(),
  where: vi.fn(),
  returning: vi.fn(),
  values: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("../db.js", () => {
  const chain = { set: io.set, where: io.where, returning: io.returning };
  const tx = { update: () => chain, insert: () => ({ values: io.values }) };
  io.set.mockReturnValue(chain);
  io.where.mockReturnValue(chain);
  io.transaction.mockImplementation(async (cb) => cb(tx));
  return { db: { ...tx, transaction: io.transaction } };
});
import {
  claimProjectBuildStart,
  pauseFailedQueueAttempt,
} from "../services/build-claim.js";
beforeEach(() => {
  vi.clearAllMocks();
  io.returning.mockResolvedValue([{ id: 41 }]);
  io.values.mockResolvedValue(undefined);
});
it("records a successful claim inside the same transaction as the status transition", async () => {
  expect(await claimProjectBuildStart(41, 7)).toBe(true);
  expect(io.transaction).toHaveBeenCalledOnce();
  const status = io.set.mock.calls[0][0];
  expect(io.values).toHaveBeenCalledWith({
    projectId: 41,
    event: "build_claim",
    payload: { claimedAt: status.updatedAt.toISOString() },
  });
  expect(io.values.mock.invocationCallOrder[0]).toBeGreaterThan(
    io.returning.mock.invocationCallOrder[0],
  );
});
it("does not record a claim when another starter wins", async () => {
  io.returning.mockResolvedValue([]);
  expect(await claimProjectBuildStart(41, 7)).toBe(false);
  expect(io.values).not.toHaveBeenCalled();
});
it("conditionally pauses the owner and inspected state while excluding every newer atomic claim", async () => {
  const updated = new Date("2026-10-04T00:01:00Z");
  expect(
    await pauseFailedQueueAttempt(41, 7, updated, "2026-10-04T00:00:00Z"),
  ).toBe(true);
  expect(io.transaction).toHaveBeenCalledOnce();
  expect(io.values).toHaveBeenCalledWith({
    projectId: 41,
    event: "build_execution_claim",
    payload: {
      revoked: true,
      createdAt: "2026-10-04T00:00:00Z",
      reason: "worker_interruption",
    },
  });
  const query = new PgDialect().sqlToQuery(io.where.mock.calls[0][0]);
  expect(query.sql).toContain('"projects"."user_id" =');
  expect(query.sql).toContain('"projects"."status" =');
  expect(query.sql).toContain('"projects"."updated_at" =');
  expect(query.sql).toContain("NOT EXISTS");
  expect(query.sql).toContain("event = 'build_claim'");
  expect(query.params).toEqual([
    41,
    7,
    "running",
    updated.toISOString(),
    41,
    "2026-10-04T00:00:00Z",
  ]);
  expect(io.set.mock.calls[0][0]).toEqual(
    expect.objectContaining({
      status: "paused",
      pauseReason: "retry_after_error",
      creditsReserved: 0,
    }),
  );
  for (const key of [
    "generatedFiles",
    "productContract",
    "productPlan",
    "agentCoordination",
    "workingArtifactVersion",
  ])
    expect(io.set.mock.calls[0][0]).not.toHaveProperty(key);
});
it("reports a lost conditional recovery race without updating saved build fields", async () => {
  io.returning.mockResolvedValue([]);
  expect(
    await pauseFailedQueueAttempt(41, 7, new Date(), "2026-10-04T00:00:00Z"),
  ).toBe(false);
  expect(io.values).not.toHaveBeenCalled();
});
