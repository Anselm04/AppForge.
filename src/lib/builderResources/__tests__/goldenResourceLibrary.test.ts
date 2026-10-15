import { describe, expect, it } from "vitest";
import type { ProductContract } from "../../productContract.js";
import { resolveIntakeContract } from "../../productContract.js";
import type { ProductPlan } from "../../productPlan.js";
import { createRequirementManifest } from "../../requirementManifest.js";
import { compareBaselineAndResourceAwareBuild } from "../resourceBuildHarness.js";

const GOLDEN_PRODUCT_PROMPT = [
  "Build an iPhone and Android restaurant table availability app.",
  "Users sign up and sign in, save restaurant watches in a database, choose preferred dates, time ranges and party sizes,",
  "monitor authorized reservation-provider API availability in the background on a recurring schedule,",
  "receive push notifications with deep links when a match appears, use hands-free voice commands with spoken replies,",
  "and only book a table after the user explicitly confirms.",
  "Charge $9.99 per month through Stripe with server-authoritative paid entitlements.",
  "Include analytics, privacy and terms, a secure backend, source export, and deployment configuration.",
].join(" ");

function planFor(contract: ProductContract): ProductPlan {
  const tasks = contract.functionalRequirements.map((requirement, index) => ({
    id: `T${index + 1}`,
    module: `Requirement ${requirement.id}`,
    description: requirement.text,
    sequence: index + 1,
    dependencies: index === 0 ? [] : [`T${index}`],
    acceptanceCriteria: [requirement.text],
    requirementIds: [requirement.id],
    files: [`src/requirements/${requirement.id.toLowerCase()}.ts`],
    agent: "general" as const,
    validations: [`validate ${requirement.id}`],
  }));
  const requirementToTasks = Object.fromEntries(
    tasks.map((task) => [task.requirementIds[0], [task.id]]),
  );
  const taskToFiles = Object.fromEntries(
    tasks.map((task) => [task.id, task.files]),
  );
  const taskToAgent = Object.fromEntries(
    tasks.map((task) => [task.id, task.agent]),
  );
  const taskToValidation = Object.fromEntries(
    tasks.map((task) => [task.id, task.validations]),
  );

  return {
    version: 1,
    title: "Golden reservation application",
    overview:
      "Contract-derived Golden Product plan used to exercise normal resource selection.",
    productType: contract.productType,
    selectedTechnologyStack: contract.selectedTechnologyStack,
    architecture: {
      summary: "Flutter client, Node backend and persistent database",
      workflows: contract.coreWorkflows,
      personas: contract.targetUsers,
      roles: contract.userRoles,
      frontendModules: ["mobile client"],
      backendModules: ["API", "background monitoring", "billing"],
      databaseModules:
        contract.dataModels.length > 0
          ? contract.dataModels
          : ["Application data"],
      aiModules: [],
      integrationModules: contract.integrations,
      authenticationDesign: "Contract-driven authenticated access",
      authorizationDesign: "Least privilege and owner-scoped data",
      billingDesign: "Server-authoritative Stripe entitlements",
      deploymentDesign: "Mobile packages plus backend deployment",
      operationsDesign: "Observable background work and provider failures",
      recoveryDesign: "Idempotent retries and durable persistence",
      monetizationPlan:
        contract.monetizationRequirements.join("; ") || "none",
    },
    implementationSequence: tasks.map((task) => task.id),
    tasks,
    requirementToTasks,
    taskToFiles,
    taskToAgent,
    taskToValidation,
    researchDecisionIds: [],
  };
}

describe("Golden Product Builder Resource Library validation", () => {
  it("uses the exact normal AppForge intake and selects reusable resources without a special product bypass", async () => {
    const intake = resolveIntakeContract(GOLDEN_PRODUCT_PROMPT);
    expect(intake.ok).toBe(true);
    if (!intake.ok) return;

    const contract = intake.productContract;
    const plan = planFor(contract);
    const requirementManifest = createRequirementManifest({
      productContract: contract,
      productPlan: plan,
    });

    let tick = 0;
    const result = await compareBaselineAndResourceAwareBuild({
      productContract: contract,
      productPlan: plan,
      requirementManifest,
      targetPlatform: "android",
      generateCapability: (capability) => ({
        [`generated/${capability}.ts`]:
          `export const ${capability.replace(/[^A-Za-z0-9_]/g, "_")} = true;\n`.repeat(
            10,
          ),
      }),
      now: () => tick++,
    });

    expect(result.resourcePlan.missingCapabilities).toEqual([]);
    expect(result.resourcePlan.conflicts).toEqual([]);
    expect(result.resourcePlan.selectedResourceIds).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^core\.authentication@/),
        expect.stringMatching(/^core\.billing@/),
        expect.stringMatching(/^core\.background-jobs@/),
        expect.stringMatching(/^core\.notifications@/),
        expect.stringMatching(/^capability\.mobile@/),
        expect.stringMatching(/^capability\.voice@/),
        expect.stringMatching(/^module\.booking@/),
      ]),
    );

    expect(result.baseline.generatorCalls).toBeGreaterThan(0);
    expect(result.resourceAware.generatorCalls).toBe(0);
    expect(result.resourceAware.reusableCapabilities).toBe(
      result.baseline.requestedCapabilities,
    );
    expect(result.improvement.generatorCallsAvoided).toBe(
      result.baseline.generatorCalls,
    );
    expect(result.improvement.generatorCallReductionPercent).toBe(100);
    expect(result.improvement.generatedCodeBytesAvoided).toBeGreaterThan(0);
    expect(
      result.resourceAware.selectedResourceVersions.length,
    ).toBeGreaterThan(0);
  });

  it("does not present the controlled harness as live provider, store or runtime certification", () => {
    expect(GOLDEN_PRODUCT_PROMPT).not.toMatch(/builder resource library/i);
    expect(GOLDEN_PRODUCT_PROMPT).not.toMatch(/special bypass/i);
  });
});
