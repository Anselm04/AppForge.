import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildProductContract,
  classifyProductIntent,
} from "../lib/productContract.js";

const io = vi.hoisted(() => ({
  project: {} as Record<string, unknown>,
  queued: vi.fn(),
  claim: vi.fn(),
  credits: vi.fn(),
}));
vi.mock("../db.js", () => ({
  getProjectById: vi.fn(async () => io.project),
  ensureUserCredits: vi.fn(async () => ({
    unlimited: true,
    tier: "lifetime",
    balance: 0,
  })),
  updateProjectCreditsReserved: io.credits,
}));
vi.mock("../services/build-claim.js", () => ({
  claimProjectBuildStart: io.claim,
  releaseProjectBuildClaim: vi.fn(),
}));
vi.mock("../services/build-queue.js", () => ({ enqueueBuild: io.queued }));
vi.mock("../services/build-event-store.js", () => ({
  appendBuildEvent: vi.fn(),
}));
import { projectsRouter } from "../routers/projects.js";

const caller = projectsRouter.createCaller({
  req: {} as never,
  res: {} as never,
  user: { id: 7, email: "unit@example.com", name: "Unit" },
});
const prompt =
  "Build a lead generation website with Stripe subscription billing";

beforeEach(() => {
  io.queued.mockReset();
  io.claim.mockReset().mockResolvedValue(true);
  io.credits.mockReset();
  io.project = {
    id: 1,
    userId: 7,
    status: "paused",
    pauseReason: "retry_after_error",
    buildStage: "researching",
    productPlan: null,
    planStatus: "planning",
    monetizationApproved: false,
    integrationsApproved: false,
    productContract: buildProductContract(prompt),
    promptIntent: classifyProductIntent(prompt),
    locale: "en",
    creditsReserved: 0,
  };
});

describe("real resume API with database and queue I/O replaced", () => {
  it("queues interrupted planning with the original contract without pretending approvals exist", async () => {
    await expect(
      caller.resumeApprovedBuild({ projectId: 1 }),
    ).resolves.toMatchObject({ success: true });
    expect(io.queued).toHaveBeenCalledWith(
      expect.objectContaining({
        description: prompt,
        productContract: io.project.productContract,
        promptIntent: io.project.promptIntent,
      }),
    );
    expect(io.project.planStatus).toBe("planning");
    expect(io.project.monetizationApproved).toBe(false);
  });
  it("still rejects retrying generation with missing plan approval", async () => {
    io.project.buildStage = "generating";
    await expect(
      caller.resumeApprovedBuild({ projectId: 1 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(io.queued).not.toHaveBeenCalled();
    expect(io.claim).not.toHaveBeenCalled();
  });
  it("keeps billing approval enforced for a saved approved plan", async () => {
    io.project.productPlan = {};
    io.project.planStatus = "approved";
    await expect(caller.resumeApprovedBuild({ projectId: 1 })).rejects.toThrow(
      "Approve monetization",
    );
    expect(io.queued).not.toHaveBeenCalled();
  });
  it("rejects another user's project and user cancellation before any queue action", async () => {
    io.project.userId = 8;
    await expect(
      caller.resumeApprovedBuild({ projectId: 1 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    io.project.userId = 7;
    io.project.pauseReason = "user_cancelled";
    await expect(
      caller.resumeApprovedBuild({ projectId: 1 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(io.queued).not.toHaveBeenCalled();
  });
});
