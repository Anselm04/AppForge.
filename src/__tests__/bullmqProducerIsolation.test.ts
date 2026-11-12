import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveIntakeContract } from "../lib/productContract.js";
import type { BuildJob } from "../lib/buildJob.js";

const state = vi.hoisted(() => ({
  createdQueues: 0,
  createdWorkers: 0,
}));
vi.mock("../_core/env.js", () => ({
  ENV: { redisUrl: "redis://queue-test", isProduction: true },
}));
vi.mock("../db.js", () => ({
  addCredits: vi.fn(),
  getCurrentArtifact: vi.fn(),
  getProjectById: vi.fn(),
}));
vi.mock("../services/build-worker.js", () => ({
  runBuildJob: vi.fn(),
  isBuildActive: vi.fn(() => false),
}));
vi.mock("../services/build-event-store.js", () => ({
  appendBuildEvent: vi.fn(),
  getLatestBuildClaimAt: vi.fn(),
  getLatestTerminalBuildEvent: vi.fn(),
}));
vi.mock("bullmq", () => ({
  Queue: class {
    constructor() {
      state.createdQueues++;
    }
    async getJob() {
      return null;
    }
    async add(_name: string, data: BuildJob) {
      return { data };
    }
    async getWaitingCount() {
      return 0;
    }
  },
  Worker: class {
    constructor() {
      state.createdWorkers++;
    }
    on() {
      return this;
    }
    async close() {}
  },
}));

function job(): BuildJob {
  const intake = resolveIntakeContract("a 2D platformer game");
  if (!intake.ok) throw new Error("Invalid test fixture");
  return {
    projectId: 100,
    userId: 200,
    description: "a 2D platformer game",
    techStack: intake.productContract.selectedTechnologyStack,
    promptIntent: intake.promptIntent,
    productContract: intake.productContract,
    createdAt: "2026-11-12T00:00:00.000Z",
    reservationCharged: false,
  };
}

let stop: (() => void) | undefined;
afterEach(() => {
  stop?.();
  stop = undefined;
  vi.resetModules();
});

describe("BullMQ producer and consumer isolation", () => {
  it("enqueues without creating a worker inside the API process", async () => {
    state.createdQueues = 0;
    state.createdWorkers = 0;
    const queue = await import("../services/build-queue.js");
    await queue.enqueueBuild(job());
    expect(state.createdQueues).toBe(1);
    expect(state.createdWorkers).toBe(0);

    stop = queue.startBuildQueueWorker(60_000);
    for (let i = 0; i < 30 && state.createdWorkers === 0; i++) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    expect(state.createdWorkers).toBe(1);
  });
});
