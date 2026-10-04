import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveIntakeContract } from "../lib/productContract.js";

const mocks = vi.hoisted(() => ({
  getJob: vi.fn(),
  add: vi.fn(),
  getWaitingCount: vi.fn(),
  refund: vi.fn(),
}));
vi.mock("../_core/env.js", () => ({
  ENV: { redisUrl: "redis://test", isProduction: true },
}));
vi.mock("../db.js", () => ({ addCredits: mocks.refund }));
vi.mock("../services/build-worker.js", () => ({ runBuildJob: vi.fn() }));
vi.mock("../services/build-event-store.js", () => ({
  getLatestTerminalBuildEvent: vi.fn(),
}));
vi.mock("bullmq", () => ({
  Queue: class {
    getJob = mocks.getJob;
    add = mocks.add;
    getWaitingCount = mocks.getWaitingCount;
  },
  Worker: class {
    on() {}
  },
}));

function job() {
  const resolved = resolveIntakeContract("a simple company website");
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
  mocks.getJob.mockResolvedValue(undefined);
  mocks.getWaitingCount.mockResolvedValue(0);
  mocks.add.mockImplementation(async (_name, data) => ({ data }));
});

describe("durable build admission", () => {
  it.each(["completed", "failed"])(
    "allows a new attempt after a retained %s job",
    async (state) => {
      const remove = vi.fn().mockResolvedValue(undefined);
      mocks.getJob.mockResolvedValue({
        getState: async () => state,
        remove,
      });
      const { enqueueBuild } = await import("../services/build-queue.js");
      await enqueueBuild(job());
      expect(remove).toHaveBeenCalledOnce();
      expect(mocks.add).toHaveBeenCalledOnce();
      expect(remove.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.add.mock.invocationCallOrder[0],
      );
    },
  );

  it("keeps active jobs and refunds a duplicate reservation", async () => {
    const remove = vi.fn();
    mocks.getJob.mockResolvedValue({ getState: async () => "active", remove });
    mocks.add.mockResolvedValue({ data: { ...job(), createdAt: "older" } });
    const { enqueueBuild } = await import("../services/build-queue.js");
    await enqueueBuild(job());
    expect(remove).not.toHaveBeenCalled();
    expect(mocks.refund).toHaveBeenCalledOnce();
  });

  it("does not reject an accepted paid job when queue metrics fail", async () => {
    mocks.getWaitingCount.mockRejectedValue(new Error("metrics unavailable"));
    const { enqueueBuild } = await import("../services/build-queue.js");
    await expect(enqueueBuild(job())).resolves.toBeUndefined();
    expect(mocks.add).toHaveBeenCalledOnce();
    expect(mocks.refund).not.toHaveBeenCalled();
  });

  it("rejects a real enqueue failure for reservation rollback", async () => {
    mocks.add.mockRejectedValue(new Error("queue unavailable"));
    const { enqueueBuild } = await import("../services/build-queue.js");
    await expect(enqueueBuild(job())).rejects.toThrow("queue unavailable");
  });
});
