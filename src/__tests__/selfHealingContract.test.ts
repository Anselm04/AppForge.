import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  project: null as Record<string, unknown> | null,
  snapshot: null as Record<string, unknown> | null,
  updates: [] as Array<Record<string, unknown>>,
}));
const agent = vi.hoisted(() => ({ runSeniorDevAgent: vi.fn() }));
const dbMocks = vi.hoisted(() => ({
  createSeniorDevTask: vi.fn(async () => 501),
  getCurrentSnapshot: vi.fn(async () => state.snapshot),
  getNextVersion: vi.fn(async () => 2),
  createBuildSnapshot: vi.fn(async () => 91),
  getSnapshotArtifact: vi.fn(),
  markSnapshotAsCurrent: vi.fn(),
  persistRequirementDeploymentEvidence: vi.fn(),
  getProjectEvidence: vi.fn(async () => []),
  recordProjectEvidence: vi.fn(
    async (_entry: { kind: string; payload: Record<string, unknown> }) =>
      undefined,
  ),
  updateProjectFiles: vi.fn(),
  updateProjectRequirementManifest: vi.fn(),
}));

vi.mock("../db.js", () => {
  const where = vi.fn(async () => undefined);
  return {
    db: {
      query: {
        projects: {
          findMany: vi.fn(async () =>
            state.project ? [{ id: state.project.id, userId: 7 }] : [],
          ),
          findFirst: vi.fn(async () => state.project),
        },
      },
      update: vi.fn(() => ({
        set: vi.fn((value: Record<string, unknown>) => {
          state.updates.push(value);
          return { where };
        }),
      })),
    },
    ...dbMocks,
  };
});
vi.mock("../agents/seniorDevAgent.js", () => agent);
vi.mock("../services/senior-dev-claim.js", () => ({
  claimSeniorDevStart: vi.fn(async () => true),
}));
vi.mock("../services/self-healing-lock.js", () => ({
  claimSelfHealingProject: vi.fn(async () => ({ key: "k", token: "t" })),
  releaseSelfHealingProject: vi.fn(async () => undefined),
}));
const deployment = vi.hoisted(() => ({ deployValidatedProject: vi.fn() }));
const recovery = vi.hoisted(() => ({ recordKnownGoodCheckpoint: vi.fn() }));
vi.mock("../services/productionAutoDeploy.js", () => deployment);
vi.mock("../services/recovery.js", () => recovery);
vi.mock("../agents/buildValidator.js", () => ({
  validateGeneratedBuild: vi.fn(async () => ({
    passed: true,
    stage: "runtime",
    errors: [],
  })),
}));

import { runSelfHealingCycle, unwatchProject } from "../agents/selfHealing.js";
import { resolveIntakeContract } from "../lib/productContract.js";
import {
  requirementManifestSchema,
  markRequirementImplementation,
  markRequirementTests,
  markRequirementValidation,
} from "../lib/requirementManifest.js";
import type { FinalProductFactoryFlowReport } from "../lib/finalProductFactoryFlow.js";

const PROMPT = "a 2D platformer game";

function contract() {
  const resolution = resolveIntakeContract(PROMPT);
  if (!resolution.ok) throw new Error("fixture prompt must resolve");
  return resolution.productContract;
}

beforeEach(() => {
  vi.clearAllMocks();
  state.updates = [];
  vi.stubEnv("SENTRY_API_TOKEN", "test-token");
  vi.stubEnv("SENTRY_ORG_SLUG", "org");
  vi.stubEnv("SENTRY_PROJECT_SLUG", "proj");
  const now = new Date().toISOString();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          id: "issue-1",
          title: "TypeError in game loop",
          culprit: "src/game.ts",
          count: 12,
          level: "error",
          firstSeen: now,
          lastSeen: now,
          permalink: "https://sentry.example/issue-1",
        },
      ],
    })),
  );
  agent.runSeniorDevAgent.mockRejectedValue(new Error("stop after capture"));
});

afterEach(() => {
  unwatchProject(41);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("self-healing repair keeps the canonical contract", () => {
  it("keeps a deployed repair recoverable without claiming restore proof", async () => {
    const productContract = contract();
    const markers = productContract.functionalRequirements
      .map(({ id }) => `// requirement: ${id}`)
      .join("\n");
    const files = {
      "index.html": markers + "\n<canvas></canvas>",
      "game.test.ts": markers,
      "repair.txt": "after",
    };
    const now = new Date().toISOString();
    let requirementManifest = requirementManifestSchema.parse({
      version: 1,
      revision: 1,
      productType: productContract.productType,
      selectedTechnologyStack: productContract.selectedTechnologyStack,
      originalPrompt: PROMPT,
      createdAt: now,
      updatedAt: now,
      changes: [],
      unresolvedMustHaveIds: [],
      requirements: productContract.functionalRequirements.map(
        (requirement) => ({
          ...requirement,
          source: "canonical_product_contract",
          sourceField: "functionalRequirements",
          taskIds: ["task-1"],
          files: ["index.html"],
          tests: [],
          validations: ["runtime"],
          implementationHash: null,
          validationEvidence: [],
          deploymentEvidence: [],
          status: "planned",
          unresolvedReason: null,
        }),
      ),
    });
    requirementManifest = markRequirementImplementation(
      requirementManifest,
      files,
    );
    requirementManifest = markRequirementTests(requirementManifest, files);
    requirementManifest = markRequirementValidation(requirementManifest, {
      passed: true,
      stage: "runtime",
    });
    state.project = {
      id: 41,
      title: "Platformer",
      status: "production-certified",
      productContract,
      requirementManifest,
    };
    state.snapshot = {
      files: { ...files, "repair.txt": "before" },
      techStack: productContract.selectedTechnologyStack,
    };
    const integrity = { sha256: "a".repeat(64) };
    dbMocks.getSnapshotArtifact.mockResolvedValue({
      snapshotId: 91,
      version: 2,
      files,
      integrity,
    });
    agent.runSeniorDevAgent.mockImplementation(async (task) => {
      task.status = "completed";
      return {
        files: { ...files },
        summary: "Fixed",
        changes: [],
        validations: [],
      };
    });
    deployment.deployValidatedProject.mockResolvedValue({
      liveUrl: "https://repair.example",
      deploymentVersion: 2,
      deploymentManifestSha256: "b".repeat(64),
      httpVerified: true,
      browserVerified: true,
      securityVerified: true,
      operationalVerified: true,
      healthPathsVerified: [],
      verification: "browser",
    });

    await runSelfHealingCycle();

    const certification = dbMocks.recordProjectEvidence.mock.calls
      .map(([entry]) => entry)
      .find((entry) => entry.kind === "certification");
    expect(
      dbMocks.recordProjectEvidence.mock.calls.filter(
        ([entry]) => entry.kind === "failure",
      ),
    ).toEqual([]);
    expect(certification).toBeDefined();
    expect(certification!.payload.missingEvidence).toContain("recovery");
    expect(state.updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "validated",
          buildStage: "deployment-verified",
        }),
      ]),
    );
    expect(
      (
        certification!.payload
          .finalProductFactoryFlow as FinalProductFactoryFlowReport
      ).incompleteSteps,
    ).toContain("recovery_verified");
    expect(certification!.payload.productionReady).toBe(false);
    expect(deployment.deployValidatedProject).toHaveBeenCalledTimes(1);
    expect(dbMocks.markSnapshotAsCurrent).toHaveBeenCalledWith(91, 41);
    expect(recovery.recordKnownGoodCheckpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotId: 91,
        artifactVersion: 2,
        artifactSha256: integrity.sha256,
        source: "production_verified",
      }),
    );
  });

  it("repairs with the contract's stack and passes the contract to the agent", async () => {
    const productContract = contract();
    state.project = {
      id: 41,
      title: "Platformer",
      status: "production-certified",
      productContract,
      requirementManifest: { requirements: [] },
    };
    state.snapshot = {
      files: { "index.html": "<canvas></canvas>" },
      techStack: productContract.selectedTechnologyStack,
    };

    await runSelfHealingCycle();

    expect(agent.runSeniorDevAgent).toHaveBeenCalledTimes(1);
    const [task, , techStack] = agent.runSeniorDevAgent.mock.calls[0];
    expect(techStack).toBe(productContract.selectedTechnologyStack);
    expect(task.productContract).toEqual(productContract);
  });

  it("does not guess a stack when the snapshot has none", async () => {
    const productContract = contract();
    state.project = {
      id: 41,
      title: "Platformer",
      status: "production-certified",
      productContract,
      requirementManifest: { requirements: [] },
    };
    state.snapshot = { files: { "index.html": "x" }, techStack: null };

    await runSelfHealingCycle();

    const [, , techStack] = agent.runSeniorDevAgent.mock.calls[0];
    expect(techStack).toBe(productContract.selectedTechnologyStack);
  });

  it("refuses to repair when the persisted contract is invalid", async () => {
    state.project = {
      id: 41,
      title: "Platformer",
      status: "production-certified",
      productContract: { productType: "game" },
      requirementManifest: { requirements: [] },
    };
    state.snapshot = { files: { "index.html": "x" }, techStack: "react-node" };

    await runSelfHealingCycle();

    expect(dbMocks.createSeniorDevTask).not.toHaveBeenCalled();
    expect(agent.runSeniorDevAgent).not.toHaveBeenCalled();
  });

  it("refuses to repair a snapshot built for a different stack", async () => {
    const productContract = contract();
    state.project = {
      id: 41,
      title: "Platformer",
      status: "production-certified",
      productContract,
      requirementManifest: { requirements: [] },
    };
    state.snapshot = { files: { "index.html": "x" }, techStack: "other-stack" };

    await runSelfHealingCycle();

    expect(dbMocks.createSeniorDevTask).not.toHaveBeenCalled();
    expect(agent.runSeniorDevAgent).not.toHaveBeenCalled();
  });
});
