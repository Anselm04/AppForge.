import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  addCredits: vi.fn(),
  getCurrentArtifact: vi.fn(),
  getProjectById: vi.fn(),
  getProjectEvidence: vi.fn(),
  recordProjectEvidence: vi.fn(),
  resumeProject: vi.fn(),
  updateProjectBuildStage: vi.fn(),
  updateProjectCreditsSpent: vi.fn(),
  updateProjectStatus: vi.fn(),
}));
const pipeline = vi.hoisted(() => ({ runAgentPipeline: vi.fn() }));
const events = vi.hoisted(() => ({ appendBuildEvent: vi.fn() }));
const stats = vi.hoisted(() => ({ recordBuildOutcome: vi.fn() }));
const recovery = vi.hoisted(() => ({ recordKnownGoodCheckpoint: vi.fn() }));
const resolverMock = vi.hoisted(() => ({
  resolveStackDependencyGraph: vi.fn(),
}));

vi.mock("../db.js", () => db);
vi.mock("../agents/pipeline.js", () => pipeline);
vi.mock("../services/build-event-store.js", () => events);
vi.mock("../services/build-runtime.js", () => ({
  clearRuntimeBuild: vi.fn(),
  publishRuntimeBuildEvent: vi.fn(),
}));
vi.mock("../services/build-queue.js", () => ({
  publishBuildEvent: vi.fn(),
}));
vi.mock("../services/vantaSync.js", () => ({
  syncComplianceToVanta: vi.fn(),
}));
vi.mock("../db/buildStats.js", () => stats);
vi.mock("../services/productionAutoDeploy.js", () => ({
  deployValidatedProject: vi.fn(),
}));
vi.mock("../services/recovery.js", () => recovery);
// Replace only the resolution function with a controllable mock; every other
// export (buildDependencyEvidence, blockedDependencyNodes, the graph type)
// stays the real implementation, so the worker exercises real downstream
// logic against hand-built graphs instead of mutating the live registry.
vi.mock("../lib/stackDependencyResolver.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../lib/stackDependencyResolver.js")>();
  return {
    ...actual,
    resolveStackDependencyGraph: resolverMock.resolveStackDependencyGraph,
  };
});

import { runBuildJob } from "../services/build-worker.js";
import { resolveIntakeContract } from "../lib/productContract.js";
import type { BuildJob } from "../lib/buildJob.js";
import type {
  ResolvedDependencyNode,
  StackDependencyGraph,
} from "../lib/stackDependencyResolver.js";

const PROMPT = "a REST API for bookings with OpenAPI documentation";

function validJob(overrides: Partial<BuildJob> = {}): BuildJob {
  const resolution = resolveIntakeContract(PROMPT);
  if (!resolution.ok) throw new Error("fixture prompt must resolve");
  return {
    projectId: 41,
    userId: 7,
    description: PROMPT,
    techStack: resolution.productContract.selectedTechnologyStack,
    promptIntent: resolution.promptIntent,
    productContract: resolution.productContract,
    createdAt: "2026-09-25T00:00:00.000Z",
    reservationCharged: true,
    ...overrides,
  };
}

function projectFor(job: BuildJob, overrides: Record<string, unknown> = {}) {
  return {
    id: job.projectId,
    userId: job.userId,
    title: "Bookings API",
    status: "queued",
    techStack: job.techStack,
    productContract: job.productContract,
    ...overrides,
  };
}

function node(
  overrides: Partial<ResolvedDependencyNode> = {},
): ResolvedDependencyNode {
  return {
    adapterId: "node-runtime",
    purpose: "runtime",
    requiredVersionConstraint: "any",
    minimumCapabilityLevel: "runnable",
    status: "resolved",
    resolvedVersion: "22",
    resolvedState: "verified",
    runnerAvailable: true,
    message: 'Node.js 22 satisfies "runnable".',
    ...overrides,
  };
}

function graph(
  overrides: Partial<StackDependencyGraph> = {},
): StackDependencyGraph {
  return {
    productType: "api",
    stackId: "api-service",
    dependencies: [node()],
    allowed: true,
    productionEligible: true,
    capabilityCeiling: "verified",
    ...overrides,
  };
}

function errorEvents(): Array<Record<string, unknown>> {
  return events.appendBuildEvent.mock.calls
    .filter(([, event]) => event === "error")
    .map(([, , data]) => data as Record<string, unknown>);
}

function expectPipelineNeverStarted() {
  expect(pipeline.runAgentPipeline).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  db.getCurrentArtifact.mockResolvedValue({
    snapshotId: 91,
    version: 3,
    files: { "src/server.ts": "console.log('ok')" },
    integrity: { sha256: "a".repeat(64) },
  });
});

describe("build worker pre-build dependency gate", () => {
  it("resolves the dependency graph for the selected stack and product type before anything else runs", async () => {
    const job = validJob();
    resolverMock.resolveStackDependencyGraph.mockReturnValue(graph());
    db.getProjectById.mockResolvedValue(projectFor(job));
    pipeline.runAgentPipeline.mockImplementation(async () => {
      db.getProjectById.mockResolvedValue(
        projectFor(job, { status: "validated" }),
      );
    });

    await runBuildJob(JSON.parse(JSON.stringify(job)));

    expect(resolverMock.resolveStackDependencyGraph).toHaveBeenCalledWith(
      job.techStack,
      job.productContract.productType,
    );
  });

  it("permits a verified dependency path and records dependency evidence on the build/job record", async () => {
    const job = validJob();
    resolverMock.resolveStackDependencyGraph.mockReturnValue(graph());
    db.getProjectById.mockResolvedValue(projectFor(job));
    pipeline.runAgentPipeline.mockImplementation(async () => {
      db.getProjectById.mockResolvedValue(
        projectFor(job, { status: "validated" }),
      );
    });

    await runBuildJob(JSON.parse(JSON.stringify(job)));

    expect(pipeline.runAgentPipeline).toHaveBeenCalledTimes(1);
    expect(db.recordProjectEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: job.projectId,
        kind: "dependency_resolution",
        payload: expect.objectContaining({
          stack: "api-service",
          productType: "api",
          allowed: true,
          productionEligible: true,
          capabilityCeiling: "verified",
          dependencies: [
            {
              adapterId: "node-runtime",
              purpose: "runtime",
              resolvedVersion: "22",
              resolvedState: "verified",
              status: "resolved",
            },
          ],
        }),
      }),
    );
    expect(errorEvents()).toEqual([]);
  });

  it("stops the build before the pipeline starts when the required adapter is missing", async () => {
    const job = validJob();
    resolverMock.resolveStackDependencyGraph.mockReturnValue(
      graph({
        allowed: false,
        productionEligible: false,
        capabilityCeiling: "unsupported",
        dependencies: [
          node({
            status: "missing_adapter",
            resolvedVersion: null,
            resolvedState: null,
            runnerAvailable: false,
            message: 'No registered adapter for "node-runtime".',
          }),
        ],
      }),
    );
    db.getProjectById.mockResolvedValue(projectFor(job));

    await runBuildJob(JSON.parse(JSON.stringify(job)));

    expectPipelineNeverStarted();
    expect(db.updateProjectStatus).toHaveBeenCalledWith(
      job.projectId,
      "failed",
      "build_dependency_blocked",
    );
    const [reported] = errorEvents();
    expect(reported.error).toBe("build_dependency_blocked");
    expect(reported.blockedDependencies).toEqual([
      expect.objectContaining({
        adapterId: "node-runtime",
        status: "missing_adapter",
      }),
    ]);
  });

  it("stops the build before the pipeline starts when the required adapter is quarantined", async () => {
    const job = validJob();
    resolverMock.resolveStackDependencyGraph.mockReturnValue(
      graph({
        allowed: false,
        productionEligible: false,
        dependencies: [
          node({
            status: "quarantined",
            message: "Quarantined: CI regression",
          }),
        ],
      }),
    );
    db.getProjectById.mockResolvedValue(projectFor(job));

    await runBuildJob(JSON.parse(JSON.stringify(job)));

    expectPipelineNeverStarted();
    expect(db.updateProjectStatus).toHaveBeenCalledWith(
      job.projectId,
      "failed",
      "build_dependency_blocked",
    );
    const [reported] = errorEvents();
    expect(reported.blockedDependencies).toEqual([
      expect.objectContaining({
        adapterId: "node-runtime",
        status: "quarantined",
      }),
    ]);
  });

  it("stops the build before the pipeline starts when the required adapter is retired", async () => {
    const job = validJob();
    resolverMock.resolveStackDependencyGraph.mockReturnValue(
      graph({
        allowed: false,
        productionEligible: false,
        dependencies: [node({ status: "retired_blocked" })],
      }),
    );
    db.getProjectById.mockResolvedValue(projectFor(job));

    await runBuildJob(JSON.parse(JSON.stringify(job)));

    expectPipelineNeverStarted();
    expect(db.updateProjectStatus).toHaveBeenCalledWith(
      job.projectId,
      "failed",
      "build_dependency_blocked",
    );
  });

  it("stops the build before the pipeline starts when the resolved version is incompatible", async () => {
    const job = validJob();
    resolverMock.resolveStackDependencyGraph.mockReturnValue(
      graph({
        allowed: false,
        productionEligible: false,
        dependencies: [
          node({
            status: "version_incompatible",
            requiredVersionConstraint: "999",
          }),
        ],
      }),
    );
    db.getProjectById.mockResolvedValue(projectFor(job));

    await runBuildJob(JSON.parse(JSON.stringify(job)));

    expectPipelineNeverStarted();
    expect(db.updateProjectStatus).toHaveBeenCalledWith(
      job.projectId,
      "failed",
      "build_dependency_blocked",
    );
  });

  it("stops the build before the pipeline starts when the capability level is insufficient", async () => {
    const job = validJob();
    resolverMock.resolveStackDependencyGraph.mockReturnValue(
      graph({
        allowed: false,
        productionEligible: false,
        dependencies: [
          node({
            status: "insufficient_capability",
            minimumCapabilityLevel: "packageable",
            resolvedState: "runnable",
          }),
        ],
      }),
    );
    db.getProjectById.mockResolvedValue(projectFor(job));

    await runBuildJob(JSON.parse(JSON.stringify(job)));

    expectPipelineNeverStarted();
    const [reported] = errorEvents();
    expect(reported.blockedDependencies).toEqual([
      expect.objectContaining({
        adapterId: "node-runtime",
        status: "insufficient_capability",
        requiredCapability: "packageable",
        currentCapability: "runnable",
      }),
    ]);
  });

  it("lets a deprecated-but-resolved dependency proceed, matching existing resolver semantics", async () => {
    const job = validJob();
    resolverMock.resolveStackDependencyGraph.mockReturnValue(
      graph({
        allowed: true,
        productionEligible: false,
        dependencies: [node({ status: "resolved_deprecated" })],
      }),
    );
    db.getProjectById.mockResolvedValue(projectFor(job));
    pipeline.runAgentPipeline.mockImplementation(async () => {
      db.getProjectById.mockResolvedValue(
        projectFor(job, { status: "validated" }),
      );
    });

    await runBuildJob(JSON.parse(JSON.stringify(job)));

    expect(pipeline.runAgentPipeline).toHaveBeenCalledTimes(1);
    expect(errorEvents()).toEqual([]);
  });

  it("lets an allowed-but-not-production-eligible dependency proceed to its honest capability ceiling", async () => {
    const job = validJob();
    resolverMock.resolveStackDependencyGraph.mockReturnValue(
      graph({
        allowed: true,
        productionEligible: false,
        capabilityCeiling: "discovered",
        dependencies: [
          node({ status: "resolved", resolvedState: "discovered" }),
        ],
      }),
    );
    db.getProjectById.mockResolvedValue(projectFor(job));
    pipeline.runAgentPipeline.mockImplementation(async () => {
      db.getProjectById.mockResolvedValue(
        projectFor(job, { status: "validated" }),
      );
    });

    await runBuildJob(JSON.parse(JSON.stringify(job)));

    // The build is allowed to proceed...
    expect(pipeline.runAgentPipeline).toHaveBeenCalledTimes(1);
    // ...but certification (evaluateCertification, called downstream with the
    // real stack adapter/evidence) is a separate, independently-enforced gate
    // not short-circuited by this pre-build check.
    expect(errorEvents()).toEqual([]);
  });

  it("calls the resolver before the expensive build runner/pipeline starts", async () => {
    const job = validJob();
    const callOrder: string[] = [];
    resolverMock.resolveStackDependencyGraph.mockImplementation(() => {
      callOrder.push("resolver");
      return graph();
    });
    db.getProjectById.mockResolvedValue(projectFor(job));
    pipeline.runAgentPipeline.mockImplementation(async () => {
      callOrder.push("pipeline");
      db.getProjectById.mockResolvedValue(
        projectFor(job, { status: "validated" }),
      );
    });

    await runBuildJob(JSON.parse(JSON.stringify(job)));

    expect(callOrder).toEqual(["resolver", "pipeline"]);
  });

  it("still completes the existing Node-based verified build path end to end", async () => {
    const job = validJob();
    resolverMock.resolveStackDependencyGraph.mockReturnValue(graph());
    db.getProjectById.mockResolvedValue(projectFor(job));
    pipeline.runAgentPipeline.mockImplementation(async () => {
      db.getProjectById.mockResolvedValue(
        projectFor(job, { status: "validated" }),
      );
    });

    await runBuildJob(JSON.parse(JSON.stringify(job)));

    expect(db.updateProjectStatus).toHaveBeenCalledWith(
      job.projectId,
      "running",
    );
    expect(pipeline.runAgentPipeline).toHaveBeenCalledTimes(1);
    expect(errorEvents()).toEqual([]);
  });
});
