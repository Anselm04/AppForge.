import { describe, expect, it } from "vitest";
import type { ProductPlan } from "../productPlan.js";
import {
  validateProductContract,
  type ProductContract,
} from "../productContract.js";
import {
  assertMustHaveRequirementsResolved,
  createRequirementManifest,
  markRequirementDeployment,
  markRequirementImplementation,
  markRequirementTests,
  markRequirementValidation,
  serializeRequirementManifest,
  validateRequirementManifest,
} from "../requirementManifest.js";

function contract(
  overrides: Partial<ProductContract> = {},
): ProductContract {
  return validateProductContract({
    version: 2,
    originalPrompt:
      "Build a task tracker where teams create tasks, complete tasks, and admins view audit history.",
    productType: "saas_application",
    productFamilies: ["frontend", "backend", "deployment"],
    targetUsers: ["Teams"],
    userRoles: ["member", "admin"],
    coreWorkflows: ["Create tasks", "Complete tasks"],
    functionalRequirements: [
      {
        id: "REQ-001",
        text: "Members can create tasks.",
        category: "workflow",
        priority: "must",
      },
      {
        id: "REQ-002",
        text: "Members can complete tasks.",
        category: "workflow",
        priority: "must",
      },
      {
        id: "REQ-003",
        text: "Admins can view audit history.",
        category: "operations",
        priority: "should",
      },
    ],
    nonFunctionalRequirements: ["Secure defaults"],
    dataModels: [],
    integrations: [],
    securityRequirements: ["Validate input"],
    deploymentRequirements: ["Deploy runnable artifact"],
    monetizationRequirements: [],
    selectedTechnologyStack: "react-node",
    researchRequirements: [],
    runtimeRequirements: ["Browser and Node runtime"],
    secondaryCapabilities: ["deployment"],
    intentConfidence: 0.99,
    canonicalInterpretation: "A team task-tracking SaaS.",
    ...overrides,
  });
}

function plan(): ProductPlan {
  return {
    version: 1,
    title: "Task Tracker",
    overview: "Task tracking SaaS",
    productType: "saas_application",
    selectedTechnologyStack: "react-node",
    architecture: {
      summary: "React and Node task tracker",
      workflows: ["Create tasks", "Complete tasks"],
      personas: ["Member", "Admin"],
      roles: ["member", "admin"],
      frontendModules: ["Task UI"],
      backendModules: ["Task API"],
      databaseModules: [],
      aiModules: [],
      integrationModules: [],
      authenticationDesign: "Session-backed auth",
      authorizationDesign: "Role checks",
      billingDesign: "Not applicable",
      deploymentDesign: "Build and deploy",
      operationsDesign: "Audit logs",
      recoveryDesign: "Snapshot rollback",
      monetizationPlan: "Not requested",
    },
    implementationSequence: ["TASK-1", "TASK-2"],
    tasks: [
      {
        id: "TASK-1",
        module: "Task workflow",
        description: "Create and complete tasks",
        sequence: 1,
        dependencies: [],
        acceptanceCriteria: ["Create and complete tasks"],
        requirementIds: ["REQ-001", "REQ-002"],
        files: ["src/tasks.ts"],
        agent: "backend",
        validations: ["task behavior tests"],
      },
      {
        id: "TASK-2",
        module: "Audit workflow",
        description: "Admin audit history",
        sequence: 2,
        dependencies: ["TASK-1"],
        acceptanceCriteria: ["Admin audit history"],
        requirementIds: ["REQ-003"],
        files: ["src/audit.ts"],
        agent: "operations",
        validations: ["audit behavior tests"],
      },
    ],
    requirementToTasks: {
      "REQ-001": ["TASK-1"],
      "REQ-002": ["TASK-1"],
      "REQ-003": ["TASK-2"],
    },
    taskToFiles: {
      "TASK-1": ["src/tasks.ts"],
      "TASK-2": ["src/audit.ts"],
    },
    taskToAgent: {
      "TASK-1": "backend",
      "TASK-2": "operations",
    },
    taskToValidation: {
      "TASK-1": ["task behavior tests"],
      "TASK-2": ["audit behavior tests"],
    },
    researchDecisionIds: [],
  };
}

function implementationFiles(): Record<string, string> {
  return {
    "src/tasks.ts": [
      "// requirement: REQ-001",
      "// requirement: REQ-002",
      "export function createTask(title:string){ return { title, done:false }; }",
      "export function completeTask(task:{title:string;done:boolean}){ return {...task,done:true}; }",
    ].join("\n"),
    "src/audit.ts": [
      "// requirement: REQ-003",
      "export function auditHistory(){ return [{action:'task.created'}]; }",
    ].join("\n"),
  };
}

describe("requirements system", () => {
  it("creates stable requirement records with priority, category, source and planner mappings", () => {
    const manifest = createRequirementManifest({
      productContract: contract(),
      productPlan: plan(),
      now: "2026-09-24T00:00:00.000Z",
    });

    expect(manifest.revision).toBe(1);
    expect(manifest.requirements.map((item) => item.id)).toEqual([
      "REQ-001",
      "REQ-002",
      "REQ-003",
    ]);
    expect(manifest.requirements[0]).toMatchObject({
      priority: "must",
      category: "workflow",
      source: "canonical_product_contract",
      sourceField: "functionalRequirements",
      taskIds: ["TASK-1"],
      files: ["src/tasks.ts"],
      validations: ["task behavior tests"],
      status: "planned",
    });
    expect(manifest.unresolvedMustHaveIds).toEqual(["REQ-001", "REQ-002"]);
  });

  it("tracks requirement modifications and planner remapping revisions", () => {
    const first = createRequirementManifest({
      productContract: contract(),
      productPlan: plan(),
      now: "2026-09-24T00:00:00.000Z",
    });
    const revisedContract = contract({
      functionalRequirements: [
        {
          id: "REQ-001",
          text: "Members can create tasks with a due date.",
          category: "workflow",
          priority: "must",
        },
        ...contract().functionalRequirements.slice(1),
      ],
    });
    const revisedPlan = plan();
    revisedPlan.tasks[0].files = ["src/tasks.ts", "src/dueDates.ts"];
    revisedPlan.taskToFiles["TASK-1"] = ["src/tasks.ts", "src/dueDates.ts"];

    const second = createRequirementManifest({
      productContract: revisedContract,
      productPlan: revisedPlan,
      previous: first,
      now: "2026-09-24T01:00:00.000Z",
    });

    expect(second.revision).toBe(2);
    expect(
      second.changes.some(
        (change) =>
          change.requirementId === "REQ-001" && change.type === "modified",
      ),
    ).toBe(true);
    expect(
      second.changes.some(
        (change) =>
          change.requirementId === "REQ-001" && change.type === "remapped",
      ),
    ).toBe(true);
  });

  it("links requirements to generated files and implementation evidence", () => {
    const planned = createRequirementManifest({
      productContract: contract(),
      productPlan: plan(),
    });
    const implemented = markRequirementImplementation(
      planned,
      implementationFiles(),
    );

    expect(
      implemented.requirements.filter((item) => item.priority === "must"),
    ).toSatisfyAll((item) => item.status === "implemented");
    expect(
      implemented.requirements.every((item) => !!item.implementationHash),
    ).toBe(true);
  });

  it("links executable tests to requirement IDs", () => {
    let manifest = createRequirementManifest({
      productContract: contract(),
      productPlan: plan(),
    });
    const files = {
      ...implementationFiles(),
      "src/tasks.test.ts":
        "// requirement: REQ-001\n// requirement: REQ-002\nexport const testEvidence=true;",
      "src/audit.test.ts":
        "// requirement: REQ-003\nexport const auditTestEvidence=true;",
    };
    manifest = markRequirementImplementation(manifest, files);
    manifest = markRequirementTests(manifest, files);

    expect(manifest.requirements[0].tests).toEqual(["src/tasks.test.ts"]);
    expect(manifest.requirements[1].tests).toEqual(["src/tasks.test.ts"]);
    expect(manifest.requirements[2].tests).toEqual(["src/audit.test.ts"]);
    expect(manifest.requirements.every((item) => item.status === "tested")).toBe(
      true,
    );
  });

  it("prevents completion while any must-have requirement is unresolved", () => {
    const manifest = createRequirementManifest({
      productContract: contract(),
      productPlan: plan(),
    });
    expect(() => assertMustHaveRequirementsResolved(manifest)).toThrow(
      /REQ-001, REQ-002/,
    );
  });

  it("resolves must-haves only after implementation and successful validation", () => {
    let manifest = createRequirementManifest({
      productContract: contract(),
      productPlan: plan(),
    });
    manifest = markRequirementImplementation(manifest, implementationFiles());
    manifest = markRequirementValidation(manifest, {
      passed: true,
      stage: "runtime",
      errors: [],
    });

    const resolved = assertMustHaveRequirementsResolved(manifest);
    expect(resolved.unresolvedMustHaveIds).toEqual([]);
    expect(resolved.requirements[0].status).toBe("validated");
    expect(resolved.requirements[1].status).toBe("validated");
  });

  it("downgrades prior validation when generated implementation changes", () => {
    let manifest = createRequirementManifest({
      productContract: contract(),
      productPlan: plan(),
    });
    const firstFiles = implementationFiles();
    manifest = markRequirementImplementation(manifest, firstFiles);
    manifest = markRequirementValidation(manifest, {
      passed: true,
      stage: "runtime",
      errors: [],
    });
    expect(manifest.unresolvedMustHaveIds).toEqual([]);

    const changedFiles = {
      ...firstFiles,
      "src/tasks.ts":
        firstFiles["src/tasks.ts"] + "\nexport const version = 2;",
    };
    manifest = markRequirementImplementation(manifest, changedFiles);

    expect(manifest.requirements[0].status).toBe("implemented");
    expect(manifest.requirements[1].status).toBe("implemented");
    expect(manifest.unresolvedMustHaveIds).toEqual(["REQ-001", "REQ-002"]);
  });

  it("records failed validation as unresolved instead of preserving stale success", () => {
    let manifest = createRequirementManifest({
      productContract: contract(),
      productPlan: plan(),
    });
    manifest = markRequirementImplementation(manifest, implementationFiles());
    manifest = markRequirementValidation(manifest, {
      passed: true,
      stage: "runtime",
      errors: [],
    });
    manifest = markRequirementValidation(manifest, {
      passed: false,
      stage: "security",
      errors: ["security gate failed"],
    });

    expect(manifest.requirements[0].status).toBe("implemented");
    expect(manifest.unresolvedMustHaveIds).toEqual(["REQ-001", "REQ-002"]);
  });

  it("links verified deployment evidence without losing requirement traceability", () => {
    let manifest = createRequirementManifest({
      productContract: contract(),
      productPlan: plan(),
    });
    manifest = markRequirementImplementation(manifest, implementationFiles());
    manifest = markRequirementValidation(manifest, {
      passed: true,
      stage: "runtime",
      errors: [],
    });
    manifest = markRequirementDeployment(manifest, {
      destination: "fly",
      url: "https://task-tracker.example.test/",
      verified: true,
      at: "2026-09-24T02:00:00.000Z",
    });

    expect(manifest.requirements[0].status).toBe("deployed");
    expect(manifest.requirements[0].deploymentEvidence[0]).toEqual({
      destination: "fly",
      url: "https://task-tracker.example.test/",
      verified: true,
      at: "2026-09-24T02:00:00.000Z",
    });
    expect(manifest.requirements[0].taskIds).toEqual(["TASK-1"]);
    expect(manifest.requirements[0].files).toEqual(["src/tasks.ts"]);
  });

  it("round-trips the persisted manifest through strict runtime validation", () => {
    const manifest = createRequirementManifest({
      productContract: contract(),
      productPlan: plan(),
    });
    expect(
      validateRequirementManifest(JSON.parse(serializeRequirementManifest(manifest))),
    ).toEqual(manifest);
  });
});
