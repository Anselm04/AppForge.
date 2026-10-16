import { describe, expect, it } from "vitest";
import type { ProductContract } from "../../productContract.js";
import type { ProductPlan } from "../../productPlan.js";
import type { RequirementManifest } from "../../requirementManifest.js";
import {
  createBuilderResourcePlan,
  deriveRequiredBuilderCapabilities,
} from "../resourcePlanning.js";

const contract: ProductContract = {
  version: 2,
  originalPrompt:
    "Build an iPhone and Android reservation app with accounts, saved bookings, notifications, voice and a paid subscription.",
  productType: "mobile_app",
  productFamilies: [
    "frontend",
    "backend",
    "database",
    "mobile",
    "auth",
    "billing",
    "integrations",
  ],
  targetUsers: ["customers"],
  userRoles: ["user"],
  coreWorkflows: ["sign in", "find availability", "confirm booking"],
  functionalRequirements: [
    {
      id: "REQ-001",
      text: "Users authenticate and persist reservation preferences.",
      category: "security",
      priority: "must",
    },
    {
      id: "REQ-002",
      text: "Paid access uses server-authoritative billing entitlements.",
      category: "monetization",
      priority: "must",
    },
  ],
  nonFunctionalRequirements: ["secure", "reliable"],
  dataModels: ["User", "ReservationPreference", "Entitlement"],
  integrations: ["reservation provider", "Stripe"],
  securityRequirements: [
    "least privilege",
    "server-authoritative entitlements",
  ],
  deploymentRequirements: ["iOS", "Android", "backend"],
  monetizationRequirements: ["monthly subscription"],
  selectedTechnologyStack: "flutter-node",
  researchRequirements: [],
  runtimeRequirements: ["Flutter", "Node"],
  secondaryCapabilities: [
    "authentication",
    "database",
    "billing",
    "notifications",
    "external_integrations",
  ],
  intentConfidence: 1,
  canonicalInterpretation: "Mobile reservation app with subscription.",
};

const plan: ProductPlan = {
  version: 1,
  title: "Reservation app",
  overview: "Flutter + Node reservation product",
  productType: "mobile_app",
  selectedTechnologyStack: "flutter-node",
  architecture: {
    summary: "Flutter client, Node API and database",
    workflows: ["sign in", "monitor", "confirm"],
    personas: ["Customer"],
    roles: ["user"],
    frontendModules: ["Auth", "Reservations"],
    backendModules: ["API", "Billing"],
    databaseModules: ["Users", "Reservations", "Entitlements"],
    aiModules: [],
    integrationModules: ["Stripe", "Reservation Provider"],
    authenticationDesign: "Authenticated users",
    authorizationDesign: "Owner scoped",
    billingDesign: "Server authoritative",
    deploymentDesign: "iOS, Android, backend",
    operationsDesign: "Observable jobs",
    recoveryDesign: "Idempotent retry",
    monetizationPlan: "Subscription",
  },
  implementationSequence: ["T1", "T2"],
  tasks: [
    {
      id: "T1",
      module: "Auth",
      description: "Authentication",
      sequence: 1,
      dependencies: [],
      acceptanceCriteria: ["Signed-in customer"],
      requirementIds: ["REQ-001"],
      files: ["lib/auth.dart"],
      agent: "security",
      validations: ["auth tests"],
    },
    {
      id: "T2",
      module: "Billing",
      description: "Billing",
      sequence: 2,
      dependencies: ["T1"],
      acceptanceCriteria: ["Entitlement enforced"],
      requirementIds: ["REQ-002"],
      files: ["server/src/billing.ts"],
      agent: "integration",
      validations: ["billing tests"],
    },
  ],
  requirementToTasks: { "REQ-001": ["T1"], "REQ-002": ["T2"] },
  taskToFiles: { T1: ["lib/auth.dart"], T2: ["server/src/billing.ts"] },
  taskToAgent: { T1: "security", T2: "integration" },
  taskToValidation: { T1: ["auth tests"], T2: ["billing tests"] },
  researchDecisionIds: [],
};

const manifest: RequirementManifest = {
  version: 1,
  revision: 1,
  productType: "mobile_app",
  selectedTechnologyStack: "flutter-node",
  originalPrompt: contract.originalPrompt,
  createdAt: "2026-10-16T00:00:00.000Z",
  updatedAt: "2026-10-16T00:00:00.000Z",
  requirements: contract.functionalRequirements.map((requirement) => ({
    id: requirement.id,
    text: requirement.text,
    priority: requirement.priority,
    category: requirement.category,
    source: "canonical_product_contract" as const,
    sourceField: "functionalRequirements",
    taskIds: plan.requirementToTasks[requirement.id] ?? [],
    files: [],
    tests: [],
    validations: [],
    implementationHash: null,
    validationEvidence: [],
    deploymentEvidence: [],
    status: "planned" as const,
    unresolvedReason: null,
  })),
  capabilityDependencies: [],
  changes: [],
  unresolvedMustHaveIds: ["REQ-001", "REQ-002"],
};

describe("Builder Resource planning", () => {
  it("derives reusable capabilities from the canonical contract without forcing product scope", () => {
    const capabilities = deriveRequiredBuilderCapabilities({
      productContract: contract,
      activeBuildCapabilities: ["voice", "localization"],
    });

    for (const expected of [
      "authentication",
      "authorization",
      "database",
      "billing",
      "monetization",
      "notifications",
      "api",
      "webhooks",
      "security",
      "mobile",
      "voice",
      "localization",
    ]) {
      expect(capabilities).toContain(expected);
    }
  });

  it("selects versioned internal resources, supplements substantive domain packs, and remains metadata-first", () => {
    const result = createBuilderResourcePlan({
      productContract: contract,
      productPlan: plan,
      requirementManifest: manifest,
      activeBuildCapabilities: ["voice", "localization"],
      now: "2026-10-16T00:00:00.000Z",
    });

    expect(result.missingCapabilities).toEqual([]);
    expect(result.selectedResourceIds).toContain("core.authentication@1.0.0");
    expect(result.selectedResourceIds).toContain("core.billing@1.0.0");
    expect(result.selectedResourceIds).toContain("capability.voice@1.0.0");
    expect(result.selectedResourceIds).toContain(
      "capability.localization@1.0.0",
    );
    expect(result.selectedResourceIds).toContain(
      "domain.voice.contract-pack@1.0.0",
    );
    expect(result.selectedResourceIds).toContain(
      "domain.localization.contract-pack@1.0.0",
    );
    expect(result.decisionEvidence.length).toBeGreaterThanOrEqual(
      result.requiredCapabilities.length,
    );

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

    expect(
      result.decisionEvidence.some(
        (decision) =>
          decision.resourceId === "domain.voice.contract-pack" &&
          decision.rationale.includes("domain-pack-for:capability.voice@1.0.0"),
      ),
    ).toBe(true);
    expect(result.retrievalMetrics.metadataQueries).toBe(
      result.requiredCapabilities.length,
    );
    expect(result.promptContext).not.toContain("capability.architecture");
  });
});
