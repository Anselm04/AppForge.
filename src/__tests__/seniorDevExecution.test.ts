import { beforeEach, describe, expect, it, vi } from "vitest";
const d = vi.hoisted(() => ({
  task: {
    id: 7,
    projectId: 8,
    userId: 1,
    request: "Fix the save button",
    mode: "autonomous",
    status: "planning",
    plan: null,
    planApproved: false,
    creditsSpent: 0,
  } as any,
  getTask: vi.fn(),
  getProject: vi.fn(),
  credits: vi.fn(),
  deduct: vi.fn(),
  updateTask: vi.fn(),
  updateFiles: vi.fn(),
  claimStart: vi.fn(),
  claimResume: vi.fn(),
  release: vi.fn(),
  stale: vi.fn(),
  touch: vi.fn(),
  refund: vi.fn(),
  outstanding: vi.fn(),
  run: vi.fn(),
  resume: vi.fn(),
}));
vi.mock("../db.js", () => ({
  getSeniorDevTaskById: d.getTask,
  getProjectById: d.getProject,
  ensureUserCredits: d.credits,
  deductCredits: d.deduct,
  updateSeniorDevTask: d.updateTask,
  updateProjectFiles: d.updateFiles,
}));
vi.mock("../agents/seniorDevAgent.js", () => ({
  runSeniorDevAgent: d.run,
  resumeAfterApproval: d.resume,
}));
vi.mock("../services/senior-dev-claim.js", () => ({
  claimSeniorDevStart: d.claimStart,
  claimSeniorDevResume: d.claimResume,
  releaseSeniorDevStartClaim: d.release,
  failStaleSeniorDevExecution: d.stale,
  touchSeniorDevExecution: d.touch,
}));
vi.mock("../services/senior-dev-reservation.js", () => ({
  refundOutstandingSeniorDevReservation: d.refund,
  wasSeniorDevReservationCharged: d.outstanding,
}));
vi.mock("../lib/projectStack.js", () => ({
  resolveProjectStack: () => ({
    techStack: "react-node",
    productContract: undefined,
  }),
}));
vi.mock("../services/buildExecutionReadiness.js", () => ({
  assertBuildExecutionReady: vi.fn(async () => {}),
}));
import {
  startSeniorDevExecution,
  settleSeniorDevExecution,
  resumeSeniorDevExecution,
} from "../services/seniorDevExecution.js";
beforeEach(() => {
  vi.clearAllMocks();
  d.task = {
    id: 7,
    projectId: 8,
    userId: 1,
    request: "Fix the save button",
    mode: "autonomous",
    status: "planning",
    plan: null,
    planApproved: false,
    creditsSpent: 0,
  };
  d.getTask.mockImplementation(async () => ({ ...d.task }));
  d.getProject.mockResolvedValue({
    id: 8,
    userId: 1,
    techStack: "react-node",
    generatedFiles: { "src/app.ts": "old" },
  });
  d.credits.mockResolvedValue({
    balance: 100,
    unlimited: false,
    tier: "starter",
  });
  d.claimStart.mockResolvedValue(true);
  d.claimResume.mockResolvedValue(true);
  d.deduct.mockResolvedValue(undefined);
  d.release.mockResolvedValue(undefined);
  d.refund.mockResolvedValue(true);
  d.outstanding.mockResolvedValue(false);
  d.updateTask.mockImplementation(async (_id, patch) =>
    Object.assign(d.task, patch),
  );
  d.updateFiles.mockResolvedValue(undefined);
  d.stale.mockResolvedValue(false);
  const execute = async (task: any) => {
    task.status = "completed";
    task.creditsSpent = 20;
    return {
      files: { "src/app.ts": "fixed" },
      changes: [{ path: "src/app.ts" }],
      validations: [],
      summary: "Save fixed",
    };
  };
  d.run.mockImplementation(execute);
  d.resume.mockImplementation(execute);
});
describe("shared Senior Dev execution independent of browser streams", () => {
  it("autonomous repair executes and persists working files and actual agent outcome", async () => {
    expect(
      await startSeniorDevExecution({ taskId: 7, userId: 1 }),
    ).toMatchObject({ status: "completed", creditsSpent: 20 });
    expect(d.run).toHaveBeenCalledOnce();
    expect(d.updateFiles).toHaveBeenCalledWith(8, { "src/app.ts": "fixed" });
    expect(d.deduct).toHaveBeenCalledOnce();
  });
  it("losing the atomic claim cannot charge or execute twice", async () => {
    d.claimStart.mockResolvedValue(false);
    await expect(
      startSeniorDevExecution({ taskId: 7, userId: 1 }),
    ).rejects.toMatchObject({ code: "senior_dev_task_active" });
    expect(d.deduct).not.toHaveBeenCalled();
    expect(d.run).not.toHaveBeenCalled();
  });
  it("charge failure releases the original task claim without execution", async () => {
    d.deduct.mockRejectedValue(new Error("fixture balance changed"));
    await expect(
      startSeniorDevExecution({ taskId: 7, userId: 1 }),
    ).rejects.toMatchObject({ code: "senior_dev_start_failed" });
    expect(d.release).toHaveBeenCalledWith(7, 1, "planning");
    expect(d.run).not.toHaveBeenCalled();
  });
  it("collaborative repair pauses and resumes through the atomic approval claim without another charge", async () => {
    d.task.mode = "collaborative";
    d.run.mockImplementation(async (task: any) => {
      task.status = "awaiting_approval";
      task.plan = { steps: ["Fix save"] };
      return {
        files: {},
        changes: [],
        validations: [],
        summary: "Review save repair",
      };
    });
    expect(
      (await startSeniorDevExecution({ taskId: 7, userId: 1 })).status,
    ).toBe("awaiting_approval");
    d.credits.mockClear();
    d.deduct.mockClear();
    expect(
      (await resumeSeniorDevExecution({ taskId: 7, userId: 1 })).status,
    ).toBe("completed");
    expect(d.claimResume).toHaveBeenCalledOnce();
    expect(d.credits).not.toHaveBeenCalled();
    expect(d.deduct).not.toHaveBeenCalled();
  });
  it("failed resume is never recorded as completed or applied to working files", async () => {
    d.task.status = "awaiting_approval";
    d.resume.mockImplementation(async (task: any) => {
      task.status = "failed";
      return {
        files: { "src/app.ts": "broken" },
        changes: [],
        validations: [],
        summary: "Validation failed",
      };
    });
    expect(
      (await resumeSeniorDevExecution({ taskId: 7, userId: 1 })).status,
    ).toBe("failed");
    expect(d.updateFiles).not.toHaveBeenCalled();
    expect(d.refund).toHaveBeenCalledOnce();
    expect(d.task.status).toBe("failed");
  });
  it("refund failure blocks a new reservation and retry", async () => {
    d.task.status = "failed";
    d.outstanding.mockResolvedValue(true);
    d.refund.mockRejectedValue(new Error("fixture refund unavailable"));
    await expect(
      startSeniorDevExecution({ taskId: 7, userId: 1 }),
    ).rejects.toMatchObject({ code: "senior_dev_refund_pending" });
    expect(d.deduct).not.toHaveBeenCalled();
    expect(d.run).not.toHaveBeenCalled();
  });
  it("SSE transport failure does not cancel actual execution", async () => {
    expect(
      (
        await startSeniorDevExecution({
          taskId: 7,
          userId: 1,
          onStarted: () => {
            throw Error("closed stream");
          },
          onProgress: () => {
            throw Error("closed stream");
          },
        })
      ).status,
    ).toBe("completed");
  });
  it("rejects another account before any claim or charge", async () => {
    await expect(
      startSeniorDevExecution({ taskId: 7, userId: 2 }),
    ).rejects.toMatchObject({ code: "senior_dev_task_not_found" });
    expect(d.claimStart).not.toHaveBeenCalled();
    expect(d.deduct).not.toHaveBeenCalled();
  });
  it("observes a live resumed repair without restarting or charging it", async () => {
    d.task.status = "executing";
    await expect(
      resumeSeniorDevExecution({ taskId: 7, userId: 1 }),
    ).rejects.toMatchObject({ code: "senior_dev_task_active" });
    expect(d.resume).not.toHaveBeenCalled();
    expect(d.deduct).not.toHaveBeenCalled();
  });
  it("recovers stale resumed work and settles its reservation without replaying provider effects", async () => {
    d.task.status = "executing";
    d.stale.mockResolvedValue(true);
    d.outstanding.mockResolvedValue(true);
    await expect(
      resumeSeniorDevExecution({ taskId: 7, userId: 1 }),
    ).rejects.toMatchObject({ code: "senior_dev_stale_execution_recovered" });
    expect(d.refund).toHaveBeenCalledOnce();
    expect(d.resume).not.toHaveBeenCalled();
    expect(d.deduct).not.toHaveBeenCalled();
  });
  it("refund-only recovery cannot accidentally start another repair after settlement", async () => {
    d.task.status = "failed";
    d.outstanding.mockResolvedValue(true);
    expect(
      (await settleSeniorDevExecution({ taskId: 7, userId: 1 })).status,
    ).toBe("failed");
    expect(d.refund).toHaveBeenCalledOnce();
    expect(d.claimStart).not.toHaveBeenCalled();
    expect(d.run).not.toHaveBeenCalled();
  });
  it("reclaimed failed resume settles even when queue error state was never persisted", async () => {
    d.task.status = "failed";
    d.outstanding.mockResolvedValue(true);
    expect(
      (await resumeSeniorDevExecution({ taskId: 7, userId: 1 })).status,
    ).toBe("failed");
    expect(d.refund).toHaveBeenCalledOnce();
    expect(d.resume).not.toHaveBeenCalled();
    expect(d.deduct).not.toHaveBeenCalled();
  });
  it("reclaimed failed resume preserves pending settlement for retry", async () => {
    d.task.status = "failed";
    d.outstanding.mockResolvedValue(true);
    d.refund.mockRejectedValue(new Error("fixture settlement unavailable"));
    await expect(
      resumeSeniorDevExecution({ taskId: 7, userId: 1 }),
    ).rejects.toMatchObject({ code: "senior_dev_refund_pending" });
    expect(d.resume).not.toHaveBeenCalled();
  });
});
