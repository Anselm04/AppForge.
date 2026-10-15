import { describe, expect, it } from "vitest";
import { buildProductContract } from "../productContract.js";
import type { ProductPlan } from "../productPlan.js";
import {
  assertProductCapabilityDependenciesReady,
  createRequirementManifest,
} from "../requirementManifest.js";

function minimalMappedPlan(contract: ReturnType<typeof buildProductContract>): ProductPlan {
  const requirementIds = contract.functionalRequirements.map(
    (requirement) => requirement.id,
  );
  const requirementToTasks = Object.fromEntries(
    requirementIds.map((id) => [id, ["TASK-001"]]),
  );

  return {
    version: 1,
    title: "Capability dependency fixture",
    overview: "Test fixture for canonical native capability dependencies.",
    productType: contract.productType,
    selectedTechnologyStack: contract.selectedTechnologyStack,
    architecture: {
      summary: "Capability-aware mobile fixture.",
      workflows: ["Use requested mobile capability"],
      personas: ["User"],
      roles: ["user"],
      frontendModules: ["Mobile UI"],
      backendModules: [],
      databaseModules: [],
      aiModules: [],
      integrationModules: [],
      authenticationDesign: "Not requested by this fixture.",
      authorizationDesign: "Not requested by this fixture.",
      billingDesign: "Not requested by this fixture.",
      deploymentDesign: "Native runtime qualification required.",
      operationsDesign: "Capability evidence remains explicit.",
      recoveryDesign: "No stateful recovery required by this fixture.",
      monetizationPlan: "Not requested by this fixture.",
    },
    implementationSequence: ["TASK-001"],
    tasks: [
      {
        id: "TASK-001",
        module: "Native capabilities",
        description: "Implement the native capabilities required by the contract.",
        sequence: 1,
        dependencies: [],
        acceptanceCriteria: ["Requested capabilities are proven at runtime."],
        requirementIds,
        files: ["lib/native_capabilities.dart"],
        agent: "frontend",
        validations: ["native capability runtime validation"],
      },
    ],
    requirementToTasks,
    taskToFiles: { "TASK-001": ["lib/native_capabilities.dart"] },
    taskToAgent: { "TASK-001": "frontend" },
    taskToValidation: {
      "TASK-001": ["native capability runtime validation"],
    },
    researchDecisionIds: [],
  } as ProductPlan;
}

describe("native capability planning dependencies", () => {
  it("records Golden Product native requirements as explicit unresolved execution dependencies", () => {
    const contract = buildProductContract(
      "Build an iPhone and Android mobile app that sends push notifications, supports hands-free voice commands with spoken replies, and monitors availability in the background on a recurring schedule.",
    );
    const manifest = createRequirementManifest({
      productContract: contract,
      productPlan: minimalMappedPlan(contract),
      now: "2026-10-15T12:00:00.000Z",
    });

    const ids = manifest.capabilityDependencies.map((dependency) => dependency.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "push_notifications",
        "deep_links",
        "speech_recognition",
        "text_to_speech",
        "microphone",
        "background_jobs",
        "scheduling",
      ]),
    );
    expect(manifest.capabilityDependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "push_notifications",
          currentState: "discovered",
          executionReady: false,
          productionReady: false,
        }),
      ]),
    );
    expect(() => assertProductCapabilityDependenciesReady(manifest)).toThrow(
      /push_notifications|capability/i,
    );
  });

  it("does not invent native dependencies for a normal website", () => {
    const contract = buildProductContract(
      "Build a simple company website with an about page and contact form.",
    );
    const manifest = createRequirementManifest({
      productContract: contract,
      productPlan: minimalMappedPlan(contract),
      now: "2026-10-15T12:00:00.000Z",
    });

    expect(manifest.capabilityDependencies).toEqual([]);
    expect(() => assertProductCapabilityDependenciesReady(manifest)).not.toThrow();
  });
});
