import { describe, expect, it } from "vitest";
import {
  ARCHITECTURE_PROCEDURES,
  architectureAgentPrompt,
  nextProcedures,
  proceduresForPhase,
} from "../lib/architectureProcedures.js";
import {
  applyModerationGate,
  normalizeQueueSnapshot,
  scoreDeployReadiness,
} from "../lib/leaderOps.js";
import {
  listCreativeStudios,
  planCreativeBuild,
} from "../lib/creativeOrchestrator.js";
import {
  createEmptyDocument,
  isGraphicsNode,
} from "../lib/graphicsEditorTypes.js";
import { BUILD_CAPABILITY_IDS } from "../lib/buildCapabilities.js";

describe("direction stack — architecture procedures", () => {
  it("covers full delivery phases", () => {
    expect(ARCHITECTURE_PROCEDURES.length).toBeGreaterThanOrEqual(10);
    expect(proceduresForPhase("pre_design").length).toBeGreaterThan(0);
    expect(proceduresForPhase("handover").length).toBeGreaterThan(0);
  });

  it("unlocks next procedures by dependency", () => {
    const initial = nextProcedures([]);
    expect(initial.some((p) => p.id === "zoning_research")).toBe(true);
    const afterBrief = nextProcedures(["brief_feasibility"]);
    expect(afterBrief.some((p) => p.id === "concept_schematic")).toBe(true);
  });

  it("builds jurisdiction-aware agent prompt", () => {
    const prompt = architectureAgentPrompt("NZ");
    expect(prompt).toContain("New Zealand");
    expect(prompt).toContain("Building Code");
    expect(prompt).toContain("ARCHITECTURE DELIVERY STACK");
  });
});

describe("direction stack — leader ops", () => {
  it("scores deploy readiness", () => {
    const result = scoreDeployReadiness({
      hasDeployUrl: true,
      healthOk: true,
      requiredEnvConfigured: 3,
      requiredEnvTotal: 3,
      dockerValidationPassed: true,
      stripeReady: false,
    });
    expect(result.max).toBe(5);
    expect(result.score).toBe(4);
    expect(result.ready).toBe(false);
  });

  it("normalizes queue snapshot", () => {
    const snap = normalizeQueueSnapshot({
      backend: "bullmq",
      depth: 2,
      activeWorkers: 1,
      failedLastHour: 0,
    });
    expect(snap.healthy).toBe(true);
  });

  it("applies moderation gate", () => {
    expect(applyModerationGate("Build a todo app").allowed).toBe(true);
    expect(
      applyModerationGate("how to make a bomb", null).allowed,
    ).toBe(false);
    expect(
      applyModerationGate("x", { allowed: false, category: "spam" }).source,
    ).toBe("ml");
  });
});

describe("direction stack — creative orchestrator", () => {
  it("plans multi-capability builds from brief", () => {
    const plan = planCreativeBuild(
      "I need an architecture BIM floor plan with CAD export and marketing landing page",
    );
    expect(BUILD_CAPABILITY_IDS).toContain(plan.primary);
    expect(plan.steps.length).toBeGreaterThan(2);
    expect(plan.studioPaths.length).toBeGreaterThan(0);
  });

  it("lists creative studios excluding web_search", () => {
    const studios = listCreativeStudios();
    expect(studios.every((s) => s.id !== "web_search")).toBe(true);
    expect(studios.length).toBe(BUILD_CAPABILITY_IDS.length - 1);
  });
});

describe("direction stack — graphics types", () => {
  it("creates empty document with strict shape", () => {
    const doc = createEmptyDocument("Test", 800, 600);
    expect(doc.width).toBe(800);
    expect(doc.activeTool).toBe("select");
    expect(doc.nodes).toEqual([]);
  });

  it("type-guards graphics nodes", () => {
    expect(
      isGraphicsNode({
        id: "1",
        type: "rect",
        transform: { x: 0, y: 0 },
        size: { width: 10, height: 10 },
      }),
    ).toBe(true);
    expect(isGraphicsNode({ foo: 1 })).toBe(false);
  });
});
