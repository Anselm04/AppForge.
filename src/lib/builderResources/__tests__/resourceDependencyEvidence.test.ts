import { describe, expect, it } from "vitest";
import type { ProductContract } from "../../productContract.js";
import type { ProductPlan } from "../../productPlan.js";
import type { RequirementManifest } from "../../requirementManifest.js";
import { createBuilderResourcePlan } from "../resourcePlanning.js";

const contract: ProductContract = {
  version: 2,
  originalPrompt:
    "Build a customer account page where users can edit profile fields and preferences.",
  productType: "mobile_app",
  productFamilies: ["frontend", "backend"],
  targetUsers: ["customers"],
  userRoles: ["user"],
  coreWorkflows: ["edit account profile", "save preferences"],
  functionalRequirements: [
    {
      id: "REQ-001",
      text: "Users can edit their account profile and preferences.",
      category: "workflow",
      priority: "must",
    },
  ],
  nonFunctionalRequirements: ["usable"],
  dataModels: [],
  integrations: [],
  securityRequirements: ["owner-scoped account data"],
  deploymentRequirements: ["Android", "iOS"],
  monetizationRequirements: [],
  selectedTechnologyStack: "flutter-node",
  researchRequirements: [],
  runtimeRequirements: ["Flutter", "Node"],
  secondaryCapabilities: [],
  intentConfidence: 1,
  canonicalInterpretation: "Mobile customer account/profile editor.",
};

const plan: ProductPlan = {
  version: 1,
  title: "Account profile",
  overview: "Customer account and preferences",
  productType: contract.productType,
  selectedTechnologyStack: contract.selectedTechnologyStack,
  architecture: {
    summary: "Flutter client and Node backend",
    workflows: contract.coreWorkflows,
    personas: ["Customer"],
    roles: contract.userRoles,
    frontendModules: ["Account"],
    backendModules: ["Account API"],
    databaseModules: [],
    aiModules: [],
    integrationModules: [],
    authenticationDesign: "Account owner session",
    authorizationDesign: "Owner scoped",
    billingDesign: "None",
    deploymentDesign: "Android and iOS",
    operationsDesign: "Structured logs",
    recoveryDesign: "Retry-safe saves",
    monetizationPlan: "None",
  },
  implementationSequence: ["T1"],
  tasks: [
    {
      id: "T1",
      module: "Account",
      description: "Build account profile editor",
      sequence: 1,
      dependencies: [],
      acceptanceCriteria: ["Account profile can be edited"],
      requirementIds: ["REQ-001"],
      files: ["lib/account.dart"],
      agent: "general",
      validations: ["account tests"],
    },
  ],
  requirementToTasks: { "REQ-001": ["T1"] },
  taskToFiles: { T1: ["lib/account.dart"] },
  taskToAgent: { T1: "general" },
  taskToValidation: { T1: ["account tests"] },
  researchDecisionIds: [],
};

const requirementManifest: RequirementManifest = {
  version: 1,
  revision: 1,
  productType: contract.productType,
  selectedTechnologyStack: contract.selectedTechnologyStack,
  originalPrompt: contract.originalPrompt,
  createdAt: "2026-10-16T00:00:00.000Z",
  updatedAt: "2026-10-16T00:00:00.000Z",
  requirements: [
    {
      id: "REQ-001",
      text: contract.functionalRequirements[0].text,
      priority: "must",
      category: "workflow",
      source: "canonical_product_contract",
      sourceField: "functionalRequirements",
      taskIds: ["T1"],
      files: ["lib/account.dart"],
      tests: [],
      validations: ["account tests"],
      implementationHash: null,
      validationEvidence: [],
      deploymentEvidence: [],
      status: "planned",
      unresolvedReason: null,
    },
  ],
  capabilityDependencies: [],
  changes: [],
  unresolvedMustHaveIds: ["REQ-001"],
};

describe("Builder Resource dependency evidence", () => {
  it("derives account management from the ProductContract and records why transitive dependencies were selected", () => {
    const result = createBuilderResourcePlan({
      productContract: contract,
      productPlan: plan,
      requirementManifest,
      activeBuildCapabilities: [],
      targetPlatform: "android",
      now: "2026-10-16T00:00:00.000Z",
    });

    expect(result.requiredCapabilities).toContain("account");
    expect(result.selectedResourceIds).toContain("core.account@1.0.0");
    expect(result.selectedResourceIds).toContain("core.authentication@1.0.0");

    const accountDecision = result.decisionEvidence.find(
      (decision) => decision.resourceId === "core.account",
    );
    expect(accountDecision?.rationale.length).toBeGreaterThan(0);

    const authDependencyDecision = result.decisionEvidence.find(
      (decision) =>
        decision.resourceId === "core.authentication" &&
        decision.rationale.includes("dependency-of:core.account@1.0.0"),
    );
    expect(authDependencyDecision).toBeTruthy();

    for (const selected of result.selectedResourceIds) {
      const separator = selected.lastIndexOf("@");
      const resourceId = selected.slice(0, separator);
      const version = selected.slice(separator + 1);
      expect(
        result.decisionEvidence.some(
          (decision) =>
            decision.resourceId === resourceId && decision.version === version,
        ),
      ).toBe(true);
    }
  });
});
