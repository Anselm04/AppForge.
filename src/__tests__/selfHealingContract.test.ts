import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  project: null as Record<string, unknown> | null,
  snapshot: null as Record<string, unknown> | null,
}));
const agent = vi.hoisted(() => ({ runSeniorDevAgent: vi.fn() }));
const dbMocks = vi.hoisted(() => ({
  createSeniorDevTask: vi.fn(async () => 501),
  getCurrentSnapshot: vi.fn(async () => state.snapshot),
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
      update: vi.fn(() => ({ set: vi.fn(() => ({ where })) })),
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
vi.mock("../services/productionAutoDeploy.js", () => ({
  deployValidatedProject: vi.fn(),
}));

import { runSelfHealingCycle, unwatchProject } from "../agents/selfHealing.js";
import { resolveIntakeContract } from "../lib/productContract.js";

const PROMPT = "a 2D platformer game";

function contract() {
  const resolution = resolveIntakeContract(PROMPT);
  if (!resolution.ok) throw new Error("fixture prompt must resolve");
  return resolution.productContract;
}

beforeEach(() => {
  vi.clearAllMocks();
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
  it("repairs with the contract's stack and passes the contract to the agent", async () => {
    const productContract = contract();
    state.project = {
      id: 41,
      title: "Platformer",
      status: "completed",
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
      status: "completed",
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
      status: "completed",
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
      status: "completed",
      productContract,
      requirementManifest: { requirements: [] },
    };
    state.snapshot = { files: { "index.html": "x" }, techStack: "other-stack" };

    await runSelfHealingCycle();

    expect(dbMocks.createSeniorDevTask).not.toHaveBeenCalled();
    expect(agent.runSeniorDevAgent).not.toHaveBeenCalled();
  });
});
