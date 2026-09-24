import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
  ENV: { redisUrl: "" } as Record<string, unknown>,
}));
const worker = vi.hoisted(() => ({
  runBuildJob: vi.fn(async (_job: unknown) => undefined),
}));
const fakeRedis = vi.hoisted(() => {
  const store = new Map<string, string>();
  const list: string[] = [];
  return {
    store,
    list,
    client: {
      on: () => undefined,
      connect: async () => undefined,
      set: async (key: string, value: string, opts?: { NX?: boolean }) => {
        if (opts?.NX && store.has(key)) return null;
        store.set(key, value);
        return "OK";
      },
      del: async (key: string) => (store.delete(key) ? 1 : 0),
      lPush: async (_key: string, value: string) => list.unshift(value),
      rPop: async () => list.pop() ?? null,
    },
  };
});

vi.mock("../_core/env.js", () => env);
vi.mock("../services/build-worker.js", () => worker);
vi.mock("../db.js", () => ({ addCredits: vi.fn() }));
vi.mock("../services/build-event-store.js", () => ({
  getLatestTerminalBuildEvent: vi.fn(),
}));
vi.mock("bullmq", () => {
  throw new Error("bullmq unavailable in this test");
});
vi.mock("redis", () => ({ createClient: () => fakeRedis.client }));

import { resolveIntakeContract } from "../lib/productContract.js";
import type { BuildJob } from "../lib/buildJob.js";

function validJob(): BuildJob {
  const resolution = resolveIntakeContract("a 2D platformer game");
  if (!resolution.ok) throw new Error("fixture prompt must resolve");
  return {
    projectId: 41,
    userId: 7,
    description: "a 2D platformer game",
    techStack: resolution.productContract.selectedTechnologyStack,
    promptIntent: resolution.promptIntent,
    productContract: resolution.productContract,
    createdAt: "2026-09-25T00:00:00.000Z",
    reservationCharged: true,
  };
}

async function loadQueue() {
  vi.resetModules();
  return import("../services/build-queue.js");
}

async function waitFor(check: () => boolean) {
  for (let i = 0; i < 100 && !check(); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

let stop: (() => void) | undefined;

beforeEach(() => {
  worker.runBuildJob.mockClear();
  fakeRedis.store.clear();
  fakeRedis.list.length = 0;
});

afterEach(() => {
  stop?.();
  stop = undefined;
});

describe("build queue preserves and enforces the typed build context", () => {
  it("delivers the identical contract and intent through the Redis list", async () => {
    env.ENV.redisUrl = "redis://test";
    const queue = await loadQueue();
    const job = validJob();

    await queue.enqueueBuild(job);
    expect(fakeRedis.store.get("appforge:build:queued:41")).toBe(job.createdAt);

    stop = queue.startBuildQueueWorker(5);
    await waitFor(() => worker.runBuildJob.mock.calls.length > 0);

    expect(worker.runBuildJob).toHaveBeenCalledTimes(1);
    expect(worker.runBuildJob.mock.calls[0][0]).toEqual(job);
    await waitFor(() => !fakeRedis.store.has("appforge:build:queued:41"));
    expect(fakeRedis.store.has("appforge:build:queued:41")).toBe(false);
  });

  it("hands an invalid queued payload to the worker to reject and still releases the claim", async () => {
    env.ENV.redisUrl = "redis://test";
    const queue = await loadQueue();
    const { promptIntent: _missing, ...legacy } = validJob();
    fakeRedis.store.set("appforge:build:queued:41", legacy.createdAt);
    fakeRedis.list.push(JSON.stringify(legacy));

    stop = queue.startBuildQueueWorker(5);
    await waitFor(() => worker.runBuildJob.mock.calls.length > 0);

    expect(worker.runBuildJob.mock.calls[0][0]).toEqual(legacy);
    await waitFor(() => !fakeRedis.store.has("appforge:build:queued:41"));
    expect(fakeRedis.store.has("appforge:build:queued:41")).toBe(false);
  });

  it("drops an unparseable Redis payload without calling the worker", async () => {
    env.ENV.redisUrl = "redis://test";
    const queue = await loadQueue();
    fakeRedis.list.push("{not json");

    stop = queue.startBuildQueueWorker(5);
    await waitFor(() => fakeRedis.list.length === 0);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(worker.runBuildJob).not.toHaveBeenCalled();
  });

  it("delivers the identical contract through the in-memory fallback queue", async () => {
    env.ENV.redisUrl = "";
    const queue = await loadQueue();
    const job = validJob();

    await queue.enqueueBuild(job);
    await waitFor(() => worker.runBuildJob.mock.calls.length > 0);

    const delivered = worker.runBuildJob.mock.calls[0][0] as BuildJob;
    expect(delivered).toEqual(job);
    expect(delivered.productContract).not.toBe(job.productContract);
  });

  it("refuses to enqueue a job without a valid contract and intent", async () => {
    env.ENV.redisUrl = "redis://test";
    const queue = await loadQueue();
    const { promptIntent: _missing, ...invalid } = validJob();

    await expect(queue.enqueueBuild(invalid as BuildJob)).rejects.toThrow();
    expect(fakeRedis.list).toEqual([]);
    expect(fakeRedis.store.size).toBe(0);
  });
});
