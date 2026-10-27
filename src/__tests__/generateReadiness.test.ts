import { beforeEach, describe, expect, it, vi } from "vitest";
const dependencies = vi.hoisted(() => ({
  createProject: vi.fn(async () => 1),
  ensureUserCredits: vi.fn(async () => ({
    unlimited: true,
    tier: "lifetime",
    balance: 100,
  })),
  countBuildsThisMonth: vi.fn(async () => 0),
  getUserTier: vi.fn(async () => "enterprise"),
  getTierBuildLimit: vi.fn(() => null),
  deductCredits: vi.fn(),
  addCredits: vi.fn(),
  enrich: vi.fn(async (contract: any) => ({ contract })),
  enqueue: vi.fn(),
  ready: vi.fn(),
  claim: vi.fn(async () => true),
  release: vi.fn(),
}));
vi.mock("../db.js", () => dependencies);
vi.mock("../lib/owner.js", () => ({ isOwnerEmail: () => true }));
vi.mock("../lib/contractEnrichment.js", () => ({
  enrichProductContract: dependencies.enrich,
}));
vi.mock("../services/build-claim.js", () => ({
  claimProjectBuildStart: dependencies.claim,
  releaseProjectBuildClaim: dependencies.release,
}));
vi.mock("../services/build-queue.js", () => ({
  enqueueBuild: dependencies.enqueue,
}));
vi.mock("../services/buildExecutionReadiness.js", () => ({
  assertBuildExecutionReady: dependencies.ready,
  BUILD_RUNTIME_UNAVAILABLE_MESSAGE: "Secure runtime unavailable",
  BuildRuntimeUnavailableError: class extends Error {
    constructor() {
      super("Secure runtime unavailable");
    }
  },
}));
import { generateRouter } from "../routes/generate.js";
import { BuildRuntimeUnavailableError } from "../services/buildExecutionReadiness.js";
const handler = (generateRouter as any).stack[0].route.stack[0].handle;
const request = () => ({
  user: { id: 1, email: "owner@example.test" },
  body: {
    title: "A useful website",
    description:
      "Build a responsive website for a local woodworking studio with a product catalogue and contact page.",
    productType: "website",
    techStack: "react-node",
  },
});
const response = () => {
  const res: any = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
};
beforeEach(() => {
  vi.clearAllMocks();
  dependencies.ready.mockReset().mockResolvedValue(undefined);
});
describe("REST generation execution preflight", () => {
  it("refuses unavailable execution before model enrichment, project creation or credit reservation", async () => {
    dependencies.ready.mockRejectedValue(new BuildRuntimeUnavailableError());
    const res = response();
    await handler(request(), res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "build_runtime_unavailable" }),
    );
    expect(dependencies.enrich).not.toHaveBeenCalled();
    expect(dependencies.createProject).not.toHaveBeenCalled();
    expect(dependencies.deductCredits).not.toHaveBeenCalled();
    expect(dependencies.enqueue).not.toHaveBeenCalled();
  });
  it("keeps existing generation and queueing when execution is ready", async () => {
    const res = response();
    await handler(request(), res);
    expect(dependencies.ready).toHaveBeenCalledOnce();
    expect(dependencies.createProject).toHaveBeenCalledOnce();
    expect(dependencies.enqueue).toHaveBeenCalledOnce();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, status: "running" }),
    );
  });
});
