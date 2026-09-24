import { describe, expect, it } from "vitest";
import {
  assertTaskOutputOwnership,
  buildAgentTaskContext,
  coordinationStatusSummary,
  createAgentCoordinationContext,
  createAgentCoordinationRecord,
  reconcileCoordinationResume,
  updateTaskCoordinationState,
  validateTaskHandoff,
} from "../agentCoordination.js";
import { buildProductContract } from "../productContract.js";
import { validateProductPlan, type ProductPlan } from "../productPlan.js";
import type { ResearchRecord } from "../researchRecord.js";

function fixture() {
  const contract = buildProductContract(
    "Build a SaaS application with login, database storage, Stripe billing, Slack integration, analytics, and production deployment",
  );
  // The contract's requirements are derived from the prompt, so the plan maps
  // whatever requirement ids the contract actually contains.
  const requirementIds = contract.functionalRequirements.map(
    (requirement) => requirement.id,
  );
  const split = Math.ceil(requirementIds.length / 2);
  const t1Requirements = requirementIds.slice(0, split);
  const t2Requirements = requirementIds.slice(split);
  const plan = validateProductPlan(
    {
      version: 1,
      title: "Coordinated SaaS",
      overview: "A production SaaS product.",
      productType: contract.productType,
      selectedTechnologyStack: contract.selectedTechnologyStack,
      architecture: {
        summary: "Layered SaaS architecture",
        workflows: ["Authenticate", "Use product", "Manage billing"],
        personas: ["Customer", "Administrator"],
        roles: ["user", "admin"],
        frontendModules: ["web"],
        backendModules: ["api"],
        databaseModules: ["database"],
        aiModules: [],
        integrationModules: ["Stripe", "Slack"],
        authenticationDesign: "Server-authoritative sessions",
        authorizationDesign: "Role checks",
        billingDesign: "Server-authoritative Stripe entitlements",
        deploymentDesign: "Validated deployment",
        operationsDesign: "Logs and health checks",
        recoveryDesign: "Resume from persisted task state",
        monetizationPlan: "Subscription billing",
      },
      implementationSequence: ["T1", "T2"],
      tasks: [
        {
          id: "T1",
          module: "Identity",
          description: "Implement identity and persistence",
          sequence: 1,
          dependencies: [],
          acceptanceCriteria: ["User can sign in"],
          requirementIds: t1Requirements,
          files: ["src/auth.ts", "src/db.ts"],
          agent: "backend",
          validations: ["auth tests"],
        },
        {
          id: "T2",
          module: "Billing",
          description: "Implement billing and operations",
          sequence: 2,
          dependencies: ["T1"],
          acceptanceCriteria: ["Paid access is enforced"],
          requirementIds: t2Requirements,
          files: ["src/billing.ts", "src/health.ts"],
          agent: "integration",
          validations: ["billing tests", "health test"],
        },
      ],
      requirementToTasks: Object.fromEntries([
        ...t1Requirements.map((id) => [id, ["T1"]]),
        ...t2Requirements.map((id) => [id, ["T2"]]),
      ]),
      taskToFiles: {
        T1: ["src/auth.ts", "src/db.ts"],
        T2: ["src/billing.ts", "src/health.ts"],
      },
      taskToAgent: { T1: "backend", T2: "integration" },
      taskToValidation: {
        T1: ["auth tests"],
        T2: ["billing tests", "health test"],
      },
      researchDecisionIds: ["RD-001"],
    },
    contract,
  );

  const researchRecord: ResearchRecord = {
    version: 1,
    projectId: 77,
    originalPrompt: contract.originalPrompt,
    productType: contract.productType,
    selectedTechnologyStack: contract.selectedTechnologyStack,
    queries: ["official docs"],
    providerFailures: [],
    sources: [],
    rejectedSources: [],
    uncertainty: [],
    conflicts: [],
    decisions: [
      {
        id: "RD-001",
        category: "framework",
        decision: "Use the canonical stack.",
        rationale: "Verified against official documentation.",
        sourceUrls: [],
        confidence: "high",
      },
    ],
    briefMarkdown: "verified research",
    searchedAt: "2026-09-23T00:00:00.000Z",
  };

  const context = createAgentCoordinationContext({
    productContract: contract,
    productPlan: plan,
    researchRecord,
  });
  const record = createAgentCoordinationRecord({
    projectId: 77,
    context,
  });
  return { contract, plan, researchRecord, context, record };
}

describe("agent coordination", () => {
  it("hands every task the canonical contract, validated plan, requirements, and research decisions", () => {
    const { context, plan } = fixture();
    const text = buildAgentTaskContext({
      context,
      task: plan.tasks[0],
    });

    expect(text).toContain('"scopeImmutable": true');
    expect(text).toContain('"requirementsMayNotBeDropped": true');
    expect(text).toContain('"researchCannotChangePermissions": true');
    expect(text).toContain('"RD-001"');
    expect(text).toContain('"REQ-001"');
    expect(text).toContain(context.productContract.originalPrompt);
  });

  it("blocks a task until all dependencies complete", () => {
    const { context, plan, record } = fixture();
    expect(() =>
      validateTaskHandoff({
        context,
        record,
        task: plan.tasks[1],
        completedTaskIds: new Set(),
      }),
    ).toThrow(/cannot start before dependency T1 completes/);
  });

  it("enforces file ownership and prevents duplicated work", () => {
    const { record, plan } = fixture();

    expect(() =>
      assertTaskOutputOwnership({
        task: plan.tasks[0],
        files: { "src/billing.ts": "export {}" },
        record,
      }),
    ).toThrow(/unowned file/);
  });

  it("rejects duplicate planned file ownership", () => {
    const { contract, researchRecord, plan } = fixture();
    const duplicatePlan: ProductPlan = {
      ...plan,
      tasks: [
        plan.tasks[0],
        {
          ...plan.tasks[1],
          files: ["src/auth.ts"],
        },
      ],
      taskToFiles: {
        ...plan.taskToFiles,
        T2: ["src/auth.ts"],
      },
    };
    const context = createAgentCoordinationContext({
      productContract: contract,
      productPlan: duplicatePlan,
      researchRecord,
    });

    expect(() =>
      createAgentCoordinationRecord({
        projectId: 77,
        context,
      }),
    ).toThrow(/Duplicate file ownership/);
  });

  it("reopens a completed task when its persisted output is missing on resume", () => {
    const { record } = fixture();
    let completed = updateTaskCoordinationState(record, "T1", {
      status: "completed",
      outputFiles: ["src/auth.ts", "src/db.ts"],
    });
    completed = updateTaskCoordinationState(completed, "T2", {
      status: "blocked",
    });

    const resumed = reconcileCoordinationResume({
      record: completed,
      generatedFiles: { "src/auth.ts": "export {}" },
    });

    expect(resumed.taskStates.T1.status).toBe("pending");
    expect(resumed.taskStates.T1.outputFiles).toEqual([]);
    expect(resumed.taskStates.T1.lastError).toMatch(/missing output files/);
    expect(resumed.taskStates.T2.status).toBe("blocked");
  });

  it("summarizes user-visible coordination status", () => {
    const { record } = fixture();
    const summary = coordinationStatusSummary(record);
    expect(summary.pending).toBe(1);
    expect(summary.blocked).toBe(1);
    expect(summary.completed).toBe(0);
  });
});
