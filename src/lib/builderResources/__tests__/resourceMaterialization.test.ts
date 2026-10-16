import { describe, expect, it } from "vitest";
import type { ProductPlanTask } from "../../productPlan.js";
import { materializeTaskBuilderResources } from "../resourceMaterialization.js";
import type { BuilderResourcePlan } from "../resourcePlanning.js";

const task: ProductPlanTask = {
  id: "T1",
  module: "Authentication",
  description: "Implement authenticated customer access",
  sequence: 1,
  dependencies: [],
  acceptanceCriteria: ["Customer can sign in"],
  requirementIds: ["REQ-001"],
  files: ["lib/auth.dart"],
  agent: "security",
  validations: ["auth tests"],
};

const plan: BuilderResourcePlan = {
  requiredCapabilities: ["authentication", "billing"],
  selectedResourceIds: ["core.authentication@1.0.0", "core.billing@1.0.0"],
  usageRecords: [],
  missingCapabilities: [],
  conflicts: [],
  viable: true,
  promptContext: "selected",
  decisionEvidence: [
    {
      capability: "authentication",
      resourceId: "core.authentication",
      version: "1.0.0",
      requirementIds: ["REQ-001"],
      rationale: ["requirements:REQ-001"],
      evidenceLedgerIds: ["baseline-pr-192"],
    },
    {
      capability: "billing",
      resourceId: "core.billing",
      version: "1.0.0",
      requirementIds: ["REQ-002"],
      rationale: ["requirements:REQ-002"],
      evidenceLedgerIds: ["baseline-pr-192"],
    },
  ],
  retrievalMetrics: {
    catalogSize: 100,
    metadataQueries: 2,
    selectedCount: 2,
  },
};

describe("task-scoped Builder Resource materialization", () => {
  it("loads only task-relevant selected resource content and keeps it bounded", () => {
    const reads: string[] = [];
    const bundle = materializeTaskBuilderResources({
      plan,
      task,
      readSource: (sourcePath) => {
        reads.push(sourcePath);
        return "x".repeat(1_000);
      },
      maxResources: 2,
      maxSourcePathsPerResource: 1,
      maxCharsPerSource: 120,
      maxTotalSourceChars: 120,
    });

    expect(bundle.selectedResourceVersionIds).toEqual([
      "core.authentication@1.0.0",
    ]);
    expect(bundle.resources).toHaveLength(1);
    expect(bundle.resources[0]?.requirementIds).toEqual(["REQ-001"]);
    expect(bundle.resources[0]?.contracts).toBeTruthy();
    expect(bundle.resources[0]?.adaptation).toBeTruthy();
    expect(bundle.resources[0]?.sourceExcerpts).toHaveLength(1);
    expect(bundle.resources[0]?.sourceExcerpts[0]?.truncated).toBe(true);
    expect(bundle.sourceCharsLoaded).toBe(120);
    expect(reads).toHaveLength(1);
    expect(bundle.promptContext).toContain("PRIVATE INTERNAL AppForge");
    expect(bundle.promptContext).not.toContain("core.billing@1.0.0");
  });

  it("falls back to normal custom generation when no selected resource is relevant", () => {
    const unrelatedTask: ProductPlanTask = {
      ...task,
      id: "T9",
      requirementIds: ["REQ-999"],
      files: ["lib/custom.dart"],
    };
    const bundle = materializeTaskBuilderResources({
      plan,
      task: unrelatedTask,
      readSource: () => {
        throw new Error("unrelated resources must not be loaded");
      },
    });

    expect(bundle.resources).toEqual([]);
    expect(bundle.sourceCharsLoaded).toBe(0);
    expect(bundle.promptContext).toMatch(/Generate the unmet task normally/);
  });
});
