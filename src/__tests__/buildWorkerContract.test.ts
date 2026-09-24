import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  addCredits: vi.fn(),
  getCurrentArtifact: vi.fn(),
  getProjectById: vi.fn(),
  resumeProject: vi.fn(),
  updateProjectCreditsSpent: vi.fn(),
  updateProjectStatus: vi.fn(),
}));
const pipeline = vi.hoisted(() => ({ runAgentPipeline: vi.fn() }));
const events = vi.hoisted(() => ({ appendBuildEvent: vi.fn() }));
const stats = vi.hoisted(() => ({ recordBuildOutcome: vi.fn() }));
const classifier = vi.hoisted(() => ({ calls: 0 }));

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
// Count classifier calls made while the worker runs: the worker must use the
// intent resolved at intake and never reclassify the prompt itself.
vi.mock("../lib/productContract.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../lib/productContract.js")>();
  return {
    ...actual,
    classifyProductIntent: (
      ...args: Parameters<typeof actual.classifyProductIntent>
    ) => {
      classifier.calls += 1;
      return actual.classifyProductIntent(...args);
    },
  };
});

import { runBuildJob } from "../services/build-worker.js";
import {
  classifyProductIntent,
  resolveIntakeContract,
} from "../lib/productContract.js";
import type { BuildJob } from "../lib/buildJob.js";

const PROMPT = "a 2D platformer game";

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
    title: "Platformer",
    status: "queued",
    techStack: job.techStack,
    productContract: job.productContract,
    ...overrides,
  };
}

function errorEvents() {
  return events.appendBuildEvent.mock.calls
    .filter(([, event]) => event === "error")
    .map(([, , data]) => (data as { error: string }).error);
}

beforeEach(() => {
  vi.clearAllMocks();
  classifier.calls = 0;
});

describe("build worker typed contract enforcement", () => {
  it("runs a valid job with the queued contract and stack, without reclassifying", async () => {
    const job = validJob();
    expect(job.productContract.productType).toBe("game");
    db.getProjectById.mockResolvedValue(projectFor(job));
    pipeline.runAgentPipeline.mockImplementation(async () => {
      db.getProjectById.mockResolvedValue(
        projectFor(job, { status: "completed" }),
      );
    });
    classifier.calls = 0;

    await runBuildJob(JSON.parse(JSON.stringify(job)));

    expect(pipeline.runAgentPipeline).toHaveBeenCalledTimes(1);
    const [projectId, prompt, stack, , , , options] =
      pipeline.runAgentPipeline.mock.calls[0];
    expect(projectId).toBe(job.projectId);
    expect(prompt.startsWith(`${PROMPT}\n`)).toBe(true);
    expect(stack).toBe(job.techStack);
    expect(options.productContract).toEqual(job.productContract);
    expect(classifier.calls).toBe(0);
    expect(errorEvents()).toEqual([]);
  });

  it("rejects a job with no prompt intent: refund, clear failure, no pipeline, no reclassification", async () => {
    const { promptIntent: _missing, ...job } = validJob();
    db.getProjectById.mockResolvedValue(projectFor(job as BuildJob));
    classifier.calls = 0;

    await runBuildJob(job);

    expect(pipeline.runAgentPipeline).not.toHaveBeenCalled();
    expect(classifier.calls).toBe(0);
    expect(db.addCredits).toHaveBeenCalledTimes(1);
    expect(db.addCredits.mock.calls[0][0]).toBe(7);
    expect(db.addCredits.mock.calls[0][4]).toBe(
      "build-refund-41-2026-09-25T00:00:00.000Z",
    );
    expect(db.updateProjectCreditsSpent).toHaveBeenCalledWith(41, 0);
    expect(stats.recordBuildOutcome).toHaveBeenCalledWith(7, false, 0);
    expect(errorEvents()).toEqual(["build_contract_invalid"]);
    expect(db.updateProjectStatus).toHaveBeenCalledWith(
      41,
      "failed",
      "build_contract_invalid",
    );
  });

  it("rejects a job whose intent is still ambiguous", async () => {
    const job = validJob();
    db.getProjectById.mockResolvedValue(projectFor(job));

    await runBuildJob({
      ...job,
      promptIntent: { ...job.promptIntent, ambiguous: true },
    });

    expect(pipeline.runAgentPipeline).not.toHaveBeenCalled();
    expect(db.updateProjectStatus).toHaveBeenCalledWith(
      41,
      "failed",
      "build_contract_invalid",
    );
  });

  it("does not refund an uncharged invalid job but still fails it clearly", async () => {
    const { productContract: _missing, ...job } = validJob({
      reservationCharged: false,
    });
    db.getProjectById.mockResolvedValue(projectFor(job as BuildJob));

    await runBuildJob(job);

    expect(db.addCredits).not.toHaveBeenCalled();
    expect(db.updateProjectStatus).toHaveBeenCalledWith(
      41,
      "failed",
      "build_contract_invalid",
    );
  });

  it("fails the build when the persisted project contract differs from the job", async () => {
    const job = validJob();
    const other = resolveIntakeContract(PROMPT, undefined, {
      productType: "website",
    });
    if (!other.ok) throw new Error("override must resolve");
    db.getProjectById.mockResolvedValue(
      projectFor(job, {
        productContract: {
          ...other.productContract,
          selectedTechnologyStack: job.techStack,
        },
      }),
    );

    await runBuildJob(job);

    expect(pipeline.runAgentPipeline).not.toHaveBeenCalled();
    expect(errorEvents()).toEqual(["build_contract_invalid"]);
    expect(db.updateProjectStatus).toHaveBeenLastCalledWith(
      41,
      "failed",
      "build_contract_invalid",
    );
    expect(db.addCredits.mock.calls[0][4]).toBe(
      "build-refund-41-2026-09-25T00:00:00.000Z",
    );
  });

  it("fails the build when the project stack column disagrees with the job", async () => {
    const job = validJob();
    db.getProjectById.mockResolvedValue(
      projectFor(job, { techStack: "some-other-stack" }),
    );

    await runBuildJob(job);

    expect(pipeline.runAgentPipeline).not.toHaveBeenCalled();
    expect(errorEvents()).toEqual(["build_contract_invalid"]);
  });

  it("fails the build when the persisted contract is missing", async () => {
    const job = validJob();
    db.getProjectById.mockResolvedValue(
      projectFor(job, { productContract: null }),
    );

    await runBuildJob(job);

    expect(pipeline.runAgentPipeline).not.toHaveBeenCalled();
    expect(errorEvents()).toEqual(["build_contract_invalid"]);
  });

  it("writes nothing for an unidentifiable payload", async () => {
    await runBuildJob({ garbage: true });
    await runBuildJob("not json object");

    expect(db.getProjectById).not.toHaveBeenCalled();
    expect(db.addCredits).not.toHaveBeenCalled();
    expect(db.updateProjectStatus).not.toHaveBeenCalled();
  });

  it("does not settle an invalid job against a project owned by someone else", async () => {
    const { promptIntent: _missing, ...job } = validJob();
    db.getProjectById.mockResolvedValue(
      projectFor(job as BuildJob, { userId: 999 }),
    );

    await runBuildJob(job);

    expect(db.addCredits).not.toHaveBeenCalled();
    expect(db.updateProjectStatus).not.toHaveBeenCalled();
  });

  it("uses the intake intent for a clarified prompt instead of re-deriving it", async () => {
    const description = "Build me something cool";
    expect(classifyProductIntent(description).ambiguous).toBe(true);
    const resolution = resolveIntakeContract(description, undefined, {
      productType: "game",
    });
    if (!resolution.ok) throw new Error("clarified intake must resolve");
    const job = validJob({
      description,
      techStack: resolution.productContract.selectedTechnologyStack,
      promptIntent: resolution.promptIntent,
      productContract: resolution.productContract,
    });
    db.getProjectById.mockResolvedValue(projectFor(job));
    classifier.calls = 0;

    await runBuildJob(job);

    expect(pipeline.runAgentPipeline).toHaveBeenCalledTimes(1);
    expect(classifier.calls).toBe(0);
    expect(errorEvents()).not.toContain("build_contract_invalid");
  });
});
