import { describe, expect, it } from "vitest";
import {
  agentCoordinationRecordSchema,
  buildAgentTaskContext,
  createAgentCoordinationContext,
  createAgentCoordinationRecord,
} from "../../agentCoordination.js";
import type { ProductContract } from "../../productContract.js";
import type { ProductPlan } from "../../productPlan.js";

const contract: ProductContract = {
  version: 2,
  originalPrompt: "Build a secure Flutter mobile account app with saved data.",
  productType: "mobile_app",
  productFamilies: ["frontend", "backend", "mobile", "auth", "database"],
  targetUsers: ["customers"],
  userRoles: ["user"],
  coreWorkflows: ["sign in", "save profile"],
  functionalRequirements: [
    {
      id: "REQ-001",
      text: "Users authenticate before editing saved profile data.",
      category: "security",
      priority: "must",
    },
  ],
  nonFunctionalRequirements: ["secure"],
  dataModels: ["UserProfile"],
  integrations: [],
  securityRequirements: ["owner-scoped profile data"],
  deploymentRequirements: ["Android", "iOS", "backend"],
  monetizationRequirements: [],
  selectedTechnologyStack: "flutter-node",
  researchRequirements: [],
  runtimeRequirements: ["Flutter", "Node"],
  secondaryCapabilities: ["authentication", "database"],
  intentConfidence: 1,
  canonicalInterpretation: "Secure mobile profile app.",
};

const plan: ProductPlan = {
  version: 1,
  title: "Profile app",
  overview: "Flutter profile client with Node backend",
  productType: "mobile_app",
  selectedTechnologyStack: "flutter-node",
  architecture: {
    summary: "Flutter + Node + database",
    workflows: ["sign in", "save profile"],
    personas: ["Customer"],
    roles: ["user"],
    frontendModules: ["Profile"],
    backendModules: ["Profile API"],
    databaseModules: ["Profiles"],
    aiModules: [],
    integrationModules: [],
    authenticationDesign: "Required",
    authorizationDesign: "Owner scoped",
    billingDesign: "None",
    deploymentDesign: "Mobile plus backend",
    operationsDesign: "Structured logs",
    recoveryDesign: "Durable database",
    monetizationPlan: "None",
  },
  implementationSequence: ["T1"],
  tasks: [
    {
      id: "T1",
      module: "Profile",
      description: "Build authenticated profile",
      sequence: 1,
      dependencies: [],
      acceptanceCriteria: ["Profile is owner-scoped"],
      requirementIds: ["REQ-001"],
      files: ["lib/profile.dart"],
      agent: "general",
      validations: ["profile test"],
    },
  ],
  requirementToTasks: { "REQ-001": ["T1"] },
  taskToFiles: { T1: ["lib/profile.dart"] },
  taskToAgent: { T1: "general" },
  taskToValidation: { T1: ["profile test"] },
  researchDecisionIds: [],
};

describe("Builder Resource coordination persistence", () => {
  it("records exact resource ids/versions and requirement-linked selection evidence in durable coordination state", () => {
    const context = createAgentCoordinationContext({
      productContract: contract,
      productPlan: plan,
    });
    const record = createAgentCoordinationRecord({ projectId: 123, context });
    const roundTrip = agentCoordinationRecordSchema.parse(
      JSON.parse(JSON.stringify(record)),
    );

    expect(roundTrip.builderResourceUsage.length).toBeGreaterThan(0);
    expect(
      roundTrip.builderResourceUsage.every((usage) =>
        /^\d+\.\d+\.\d+/.test(usage.version),
      ),
    ).toBe(true);
    expect(roundTrip.builderResourceDecisionEvidence.length).toBeGreaterThan(0);
    expect(
      roundTrip.builderResourceDecisionEvidence.some((decision) =>
        decision.requirementIds.includes("REQ-001"),
      ),
    ).toBe(true);
  });

  it("hands task-scoped reusable implementation content to the specialist without replacing custom-code scope", () => {
    const context = createAgentCoordinationContext({
      productContract: contract,
      productPlan: plan,
    });
    const parsed = JSON.parse(
      buildAgentTaskContext({ context, task: plan.tasks[0] }),
    );
    expect(parsed.builderResources.selectedResourceIds.length).toBeGreaterThan(
      0,
    );
    expect(
      parsed.builderResources.materializedImplementation
        .selectedResourceVersionIds.length,
    ).toBeGreaterThan(0);
    expect(
      parsed.builderResources.materializedImplementation.sourceCharsLoaded,
    ).toBeGreaterThan(0);
    expect(
      parsed.builderResources.materializedImplementation.promptContext,
    ).toContain("PRIVATE INTERNAL AppForge");
    expect(parsed.coordinationRules.resourceLibraryServesProductContract).toBe(
      true,
    );
    expect(
      parsed.coordinationRules.adaptReusableResourcesBeforeGeneratingDuplicates,
    ).toBe(true);
    expect(
      parsed.coordinationRules.generateCustomCodeForUnmetRequirements,
    ).toBe(true);
  });
});
