import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveIntakeContract } from "../lib/productContract.js";
const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: any[]) => void>(),
  claimAt: vi.fn(),
  getJob: vi.fn(),
  getProject: vi.fn(),
  refund: vi.fn(),
  pause: vi.fn(),
  active: vi.fn(() => false),
  event: vi.fn(),
  publish: vi.fn(),
}));
vi.mock("../_core/env.js", () => ({
  ENV: { redisUrl: "redis://test", isProduction: true },
}));
vi.mock("../db.js", () => ({
  addCredits: mocks.refund,
  getProjectById: mocks.getProject,
}));
vi.mock("../services/build-claim.js", () => ({
  pauseFailedQueueAttempt: mocks.pause,
}));
vi.mock("../services/build-worker.js", () => ({
  runBuildJob: vi.fn(),
  isBuildActive: mocks.active,
}));
vi.mock("../services/build-event-store.js", () => ({
  appendBuildEvent: mocks.event,
  getLatestBuildClaimAt: mocks.claimAt,
  getLatestTerminalBuildEvent: vi.fn(),
}));
vi.mock("../services/build-runtime.js", () => ({
  publishRuntimeBuildEvent: mocks.publish,
}));
vi.mock("redis", () => ({
  createClient: () => ({
    on() {},
    connect: async () => {},
    publish: async () => {},
  }),
}));
vi.mock("bullmq", () => ({
  Queue: class {
    getJob = mocks.getJob;
    getWaitingCount = async () => 0;
  },
  Worker: class {
    close = async () => {};
    on(name: string, cb: (...args: any[]) => void) {
      mocks.handlers.set(name, cb);
    }
  },
}));
function attempt() {
  const resolved = resolveIntakeContract("Build a simple company website");
  if (!resolved.ok) throw new Error("Fixture must resolve");
  return {
    projectId: 41,
    userId: 7,
    description: resolved.productContract.originalPrompt,
    techStack: resolved.productContract.selectedTechnologyStack,
    promptIntent: resolved.promptIntent,
    productContract: resolved.productContract,
    createdAt: "2026-10-04T00:00:00Z",
    reservationCharged: true,
  };
}
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.handlers.clear();
  mocks.claimAt.mockResolvedValue(null);
  mocks.active.mockReturnValue(false);
  mocks.pause.mockResolvedValue(true);
  mocks.getProject.mockResolvedValue({
    id: 41,
    userId: 7,
    status: "running",
    updatedAt: new Date("2026-10-04T00:01:00Z"),
  });
  mocks.getJob.mockResolvedValue({
    data: attempt(),
    getState: async () => "failed",
  });
});
describe("terminal queue interruption recovery", () => {
  it("makes a terminally failed worker attempt retryable and refunds its original reservation", async () => {
    const queue = await import("../services/build-queue.js");
    const stop = queue.startBuildQueueWorker(60_000);
    for (let i = 0; i < 30 && !mocks.handlers.has("failed"); i++)
      await new Promise((r) => setTimeout(r, 5));
    await mocks.handlers.get("failed")?.(
      { data: attempt() },
      new Error("job stalled more than allowable limit"),
    );
    for (let i = 0; i < 30 && !mocks.pause.mock.calls.length; i++)
      await new Promise((r) => setTimeout(r, 5));
    stop();
    expect(mocks.pause).toHaveBeenCalledWith(
      41,
      7,
      new Date("2026-10-04T00:01:00Z"),
      "2026-10-04T00:00:00Z",
    );
    expect(mocks.refund).toHaveBeenCalledWith(
      7,
      expect.any(Number),
      "build_refund",
      expect.any(String),
      "build-refund-41-2026-10-04T00:00:00Z",
    );
    expect(mocks.event).toHaveBeenCalledWith(
      41,
      "error",
      expect.objectContaining({ error: "retry_after_error" }),
    );
  });
});

async function recoveryQueue() {
  const queue = await import("../services/build-queue.js");
  const stop = queue.startBuildQueueWorker(60_000);
  for (let i = 0; i < 30 && !mocks.handlers.has("failed"); i++)
    await new Promise((r) => setTimeout(r, 5));
  return { queue, stop };
}

it.each(["active", "waiting", "delayed", "completed"])(
  "does not settle a %s queue job",
  async (state) => {
    mocks.getJob.mockResolvedValue({
      data: attempt(),
      getState: async () => state,
    });
    const { queue, stop } = await recoveryQueue();
    try {
      expect((await queue.recoverFailedQueuedBuild(41, 7)).recovered).toBe(
        false,
      );
    } finally {
      stop();
    }
    expect(mocks.refund).not.toHaveBeenCalled();
    expect(mocks.pause).not.toHaveBeenCalled();
  },
);
it("does not recover another owner's job", async () => {
  const { queue, stop } = await recoveryQueue();
  try {
    expect((await queue.recoverFailedQueuedBuild(41, 99)).recovered).toBe(
      false,
    );
  } finally {
    stop();
  }
  expect(mocks.refund).not.toHaveBeenCalled();
  expect(mocks.pause).not.toHaveBeenCalled();
});
it("does not recover while this process still executes the build", async () => {
  mocks.active.mockReturnValue(true);
  const { queue, stop } = await recoveryQueue();
  try {
    expect((await queue.recoverFailedQueuedBuild(41, 7)).recovered).toBe(false);
  } finally {
    stop();
  }
  expect(mocks.getJob).not.toHaveBeenCalled();
  expect(mocks.refund).not.toHaveBeenCalled();
});
it("does not mistake an old retained failure for a newer in-flight claim", async () => {
  mocks.claimAt.mockResolvedValue("2026-10-04T00:02:00Z");
  const { queue, stop } = await recoveryQueue();
  try {
    expect((await queue.recoverFailedQueuedBuild(41, 7)).recovered).toBe(false);
  } finally {
    stop();
  }
  expect(mocks.refund).not.toHaveBeenCalled();
  expect(mocks.pause).not.toHaveBeenCalled();
});
it("refuses a queue attempt replaced during inspection", async () => {
  mocks.getJob
    .mockResolvedValueOnce({ data: attempt(), getState: async () => "failed" })
    .mockResolvedValueOnce({
      data: { ...attempt(), createdAt: "2026-10-04T00:02:00Z" },
      getState: async () => "failed",
    });
  const { queue, stop } = await recoveryQueue();
  try {
    expect((await queue.recoverFailedQueuedBuild(41, 7)).recovered).toBe(false);
  } finally {
    stop();
  }
  expect(mocks.refund).not.toHaveBeenCalled();
  expect(mocks.pause).not.toHaveBeenCalled();
});
it("keeps the project running if refund settlement fails", async () => {
  mocks.refund.mockRejectedValueOnce(new Error("ledger unavailable"));
  const { queue, stop } = await recoveryQueue();
  try {
    await expect(queue.recoverFailedQueuedBuild(41, 7)).rejects.toThrow(
      "ledger unavailable",
    );
  } finally {
    stop();
  }
  expect(mocks.pause).not.toHaveBeenCalled();
  expect(mocks.event).not.toHaveBeenCalled();
});
it("does not publish a terminal event if the conditional state update loses a race", async () => {
  mocks.pause.mockResolvedValue(false);
  const { queue, stop } = await recoveryQueue();
  try {
    expect((await queue.recoverFailedQueuedBuild(41, 7)).recovered).toBe(false);
  } finally {
    stop();
  }
  expect(mocks.event).not.toHaveBeenCalled();
  expect(mocks.publish).not.toHaveBeenCalled();
});
it("recovers an unlimited build without creating a credit grant", async () => {
  mocks.getJob.mockResolvedValue({
    data: { ...attempt(), reservationCharged: false },
    getState: async () => "failed",
  });
  const { queue, stop } = await recoveryQueue();
  try {
    expect((await queue.recoverFailedQueuedBuild(41, 7)).recovered).toBe(true);
  } finally {
    stop();
  }
  expect(mocks.refund).not.toHaveBeenCalled();
  expect(mocks.pause).toHaveBeenCalledOnce();
});
