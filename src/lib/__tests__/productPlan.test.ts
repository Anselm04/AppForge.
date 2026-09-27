import { describe, expect, it } from "vitest";
import {
  parseAndValidateProductPlan,
  parsePlannerJson,
  stripPlannerMarkdownFence,
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
  const integrationRequirementId =
    contract.functionalRequirements.find((requirement) =>
      /stripe|billing|payment|subscription/i.test(requirement.text),
    )?.id ?? requirementIds[0];
  const requirementToTasks = Object.fromEntries([
    ...task1Requirements.map((id) => [id, ["TASK-001"]]),
    ...task2Requirements.map((id) => [id, ["TASK-002"]]),
  ]) as Record<string, string[]>;
  requirementToTasks[integrationRequirementId] = [
    ...new Set([
      ...(requirementToTasks[integrationRequirementId] ?? []),
      "TASK-004",
    ]),
  ];

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
    implementationSequence: ["TASK-001", "TASK-002", "TASK-003", "TASK-004"],
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
      {
        id: "TASK-003",
        module: "Database persistence",
        description:
          "Implement contract-derived schema, migrations, tenancy, seed safety, and recovery.",
        sequence: 3,
        dependencies: ["TASK-001"],
        acceptanceCriteria: [
          "Persistence is tenant-safe, transactional, migratable, and recoverable.",
        ],
        requirementIds: [requirementIds[0]],
        files: [
          "src/db/schema.ts",
          "src/db/repository.ts",
          "database/migrations/20260927_initial.sql",
          "database/seed.ts",
          "docs/DATABASE_RECOVERY.md",
        ],
        agent: "database" as const,
        validations: [
          "database schema and migration test",
          "tenant transaction isolation test",
          "database backup restore rehearsal",
        ],
      },
      {
        id: "TASK-004",
        module: "Stripe integration",
        description:
          "Implement server-side Stripe client, verified health, webhook safety, rate limits, and setup.",
        sequence: 4,
        dependencies: ["TASK-002"],
        acceptanceCriteria: [
          "Stripe is explicitly configured, actively verifiable, retry-safe, and webhook-idempotent.",
        ],
        requirementIds: [integrationRequirementId],
        files: [
          "src/server/integrations/stripeClient.ts",
          "src/server/integrations/health.ts",
          "src/server/webhooks/stripe.ts",
          ".env.example",
          "docs/INTEGRATIONS.md",
        ],
        agent: "integration" as const,
        validations: [
          "Stripe integration timeout retry rate-limit health test",
          "Stripe webhook signature idempotency test",
        ],
      },
    ],
    requirementToTasks,
    taskToFiles: {
      "TASK-001": ["src/auth.ts", "src/tenancy.ts"],
      "TASK-002": ["src/billing.ts", "src/health.ts"],
      "TASK-003": [
        "src/db/schema.ts",
        "src/db/repository.ts",
        "database/migrations/20260927_initial.sql",
        "database/seed.ts",
        "docs/DATABASE_RECOVERY.md",
      ],
      "TASK-004": [
        "src/server/integrations/stripeClient.ts",
        "src/server/integrations/health.ts",
        "src/server/webhooks/stripe.ts",
        ".env.example",
        "docs/INTEGRATIONS.md",
      ],
    },
    taskToAgent: {
      "TASK-001": "backend",
      "TASK-002": "deployment",
      "TASK-003": "database",
      "TASK-004": "integration",
    },
    taskToValidation: {
      "TASK-001": ["auth integration test", "tenant isolation test"],
      "TASK-002": ["billing webhook test", "runtime health test"],
      "TASK-003": [
        "database schema and migration test",
        "tenant transaction isolation test",
        "database backup restore rehearsal",
      ],
      "TASK-004": [
        "Stripe integration timeout retry rate-limit health test",
        "Stripe webhook signature idempotency test",
      ],
    },
    researchDecisionIds: ["RD-001", "RD-002", "RD-003"],
  };
}

describe("contract-aware planner schema", () => {
  it("accepts a complete structured plan", () => {
    const plan = validateProductPlan(validPlan(), contract);
    expect(plan.tasks).toHaveLength(4);
    expect(plan.architecture.personas).toContain("Team member");
  });

  it("parses direct JSON without regex extraction from prose", () => {
    const plan = parseAndValidateProductPlan(
      JSON.stringify(validPlan()),
      contract,
    );
    expect(plan.title).toBe("Team CRM");
    expect(() => parsePlannerJson('prefix {"version":1} suffix')).toThrow(
      /invalid JSON/i,
    );
  });

  it("parses markdown-fenced JSON without burning a retry", () => {
    const fenced = "```json\n" + JSON.stringify(validPlan(), null, 2) + "\n```";
    expect(stripPlannerMarkdownFence(fenced).startsWith("{")).toBe(true);
    const plan = parseAndValidateProductPlan(fenced, contract);
    expect(plan.title).toBe("Team CRM");
    expect(plan.tasks).toHaveLength(4);

    const plainFence = "```\n" + JSON.stringify(validPlan()) + "\n```\n";
    expect(
      parseAndValidateProductPlan(plainFence, contract).overview,
    ).toContain("multi-tenant");
  });

  it("rejects Core App in architecture modules for complex products", () => {
    const plan = validPlan();
    plan.architecture.frontendModules = ["Core UI", "CRM UI"];
    expect(() => validateProductPlan(plan, contract)).toThrow(
      /generic output/i,
    );
  });

  it("formats Zod schema errors for planner retries", () => {
    expect(() =>
      validateProductPlan({ version: 1, title: 123 }, contract),
    ).toThrow(/title|Required|expected/i);
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

  it("rejects database-capable plans without database-owned persistence artifacts", () => {
    const plan = validPlan();
    plan.tasks = plan.tasks.filter((task) => task.id !== "TASK-003");
    plan.implementationSequence = ["TASK-001", "TASK-002", "TASK-004"];
    delete (plan.taskToFiles as Record<string, string[]>)["TASK-003"];
    delete (plan.taskToAgent as Record<string, string>)["TASK-003"];
    delete (plan.taskToValidation as Record<string, string[]>)["TASK-003"];

    expect(() => validateProductPlan(plan, contract)).toThrow(
      /database-owned task/i,
    );
  });

  it("rejects integration-capable plans without integration-owned implementation artifacts", () => {
    const plan = validPlan();
    plan.tasks = plan.tasks.filter((task) => task.id !== "TASK-004");
    plan.implementationSequence = ["TASK-001", "TASK-002", "TASK-003"];
    delete (plan.taskToFiles as Record<string, string[]>)["TASK-004"];
    delete (plan.taskToAgent as Record<string, string>)["TASK-004"];
    delete (plan.taskToValidation as Record<string, string[]>)["TASK-004"];

    expect(() => validateProductPlan(plan, contract)).toThrow(
      /integration-owned task/i,
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
