import { describe, expect, it } from "vitest";
import {
  parseAndValidateProductPlan,
  parsePlannerJson,
  validateProductPlan,
} from "../productPlan.js";
import { buildProductContract } from "../productContract.js";

const contract = buildProductContract(
  "Build a paid multi-tenant SaaS application for teams with login, Stripe billing, database storage, admin controls, and production deployment",
);

// Requirements are derived from the prompt, so the fixture plan maps every
// requirement id the contract actually contains across the two tasks.
const requirementIds = contract.functionalRequirements.map(
  (requirement) => requirement.id,
);
const task1Requirements = requirementIds.slice(
  0,
  Math.ceil(requirementIds.length / 2),
);
const task2Requirements = requirementIds.slice(task1Requirements.length);

function validPlan() {
  return {
    version: 1 as const,
    title: "Team CRM",
    overview: "A multi-tenant CRM with billing and administration.",
    productType: "saas_application",
    selectedTechnologyStack: "react-node",
    architecture: {
      summary: "Web client, API, database, billing, and operations modules.",
      workflows: ["Sign in", "Manage contacts", "Manage subscription"],
      personas: ["Team member", "Organization administrator"],
      roles: ["user", "admin", "team_member"],
      frontendModules: ["Auth UI", "CRM UI", "Billing UI"],
      backendModules: ["Auth API", "CRM API", "Billing API"],
      databaseModules: ["Users", "Organizations", "Contacts", "Subscriptions"],
      aiModules: [],
      integrationModules: ["Stripe"],
      authenticationDesign:
        "Session-based authentication with refresh handling.",
      authorizationDesign: "Server-side role and tenant checks.",
      billingDesign: "Server-authoritative Stripe subscription entitlements.",
      deploymentDesign: "Build, health-check, and deploy the selected stack.",
      operationsDesign: "Structured logs, health checks, alerts, and metrics.",
      recoveryDesign: "Known-good snapshots and rollback procedures.",
      monetizationPlan: "Paid subscription tiers with enforced entitlements.",
    },
    implementationSequence: ["TASK-001", "TASK-002"],
    tasks: [
      {
        id: "TASK-001",
        module: "Identity and tenancy",
        description: "Implement auth, users, organizations, and authorization.",
        sequence: 1,
        dependencies: [],
        acceptanceCriteria: [
          "Users can sign in and tenant access is enforced.",
        ],
        requirementIds: [...task1Requirements],
        files: ["src/auth.ts", "src/tenancy.ts"],
        agent: "backend" as const,
        validations: ["auth integration test", "tenant isolation test"],
      },
      {
        id: "TASK-002",
        module: "Billing and runtime",
        description:
          "Implement subscription entitlements and production runtime.",
        sequence: 2,
        dependencies: ["TASK-001"],
        acceptanceCriteria: [
          "Paid access is enforced and runtime health passes.",
        ],
        requirementIds: [...task2Requirements],
        files: ["src/billing.ts", "src/health.ts"],
        agent: "deployment" as const,
        validations: ["billing webhook test", "runtime health test"],
      },
    ],
    requirementToTasks: Object.fromEntries([
      ...task1Requirements.map((id) => [id, ["TASK-001"]]),
      ...task2Requirements.map((id) => [id, ["TASK-002"]]),
    ]) as Record<string, string[]>,
    taskToFiles: {
      "TASK-001": ["src/auth.ts", "src/tenancy.ts"],
      "TASK-002": ["src/billing.ts", "src/health.ts"],
    },
    taskToAgent: {
      "TASK-001": "backend",
      "TASK-002": "deployment",
    },
    taskToValidation: {
      "TASK-001": ["auth integration test", "tenant isolation test"],
      "TASK-002": ["billing webhook test", "runtime health test"],
    },
    researchDecisionIds: ["RD-001", "RD-002", "RD-003"],
  };
}

describe("contract-aware planner schema", () => {
  it("accepts a complete structured plan", () => {
    const plan = validateProductPlan(validPlan(), contract);
    expect(plan.tasks).toHaveLength(2);
    expect(plan.architecture.personas).toContain("Team member");
  });

  it("parses direct JSON without regex extraction", () => {
    const plan = parseAndValidateProductPlan(
      JSON.stringify(validPlan()),
      contract,
    );
    expect(plan.title).toBe("Team CRM");
    expect(() => parsePlannerJson('prefix {"version":1} suffix')).toThrow();
  });

  it("rejects empty planner responses", () => {
    expect(() => parsePlannerJson("   ")).toThrow(/empty response/i);
  });

  it("rejects plans that drop must-have requirements", () => {
    const plan = validPlan();
    delete (plan.requirementToTasks as Record<string, string[]>)["REQ-003"];
    expect(() => validateProductPlan(plan, contract)).toThrow(
      /dropped must-have requirement REQ-003/,
    );
  });

  it("rejects generic Core App output for complex products", () => {
    const plan = validPlan();
    plan.tasks[0].module = "Core App";
    expect(() => validateProductPlan(plan, contract)).toThrow(
      /generic output/i,
    );
  });

  it("rejects task mappings that disagree with task files", () => {
    const plan = validPlan();
    plan.taskToFiles["TASK-001"] = ["src/wrong.ts"];
    expect(() => validateProductPlan(plan, contract)).toThrow(
      /file mapping disagrees/i,
    );
  });

  it("rejects stack or product reinterpretation", () => {
    const wrongStack = validPlan();
    wrongStack.selectedTechnologyStack = "next-node";
    expect(() => validateProductPlan(wrongStack, contract)).toThrow(
      /stack does not match/i,
    );

    const wrongType = validPlan();
    wrongType.productType = "website";
    expect(() => validateProductPlan(wrongType, contract)).toThrow(
      /product type does not match/i,
    );
  });
});
