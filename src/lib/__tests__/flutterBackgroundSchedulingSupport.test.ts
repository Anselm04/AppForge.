import { describe, expect, it } from "vitest";
import { ensureCodeGenerationSupportFiles } from "../codeGeneration.js";
import type { ProductContract } from "../productContract.js";
import type { ProductPlan } from "../productPlan.js";

function contract(
  prompt: string,
  productType: ProductContract["productType"] = "mobile_app",
): ProductContract {
  return {
    version: 2,
    originalPrompt: prompt,
    productType,
    productFamilies:
      productType === "mobile_app"
        ? ["frontend", "backend", "mobile"]
        : ["frontend"],
    targetUsers: ["customers"],
    userRoles: ["user"],
    coreWorkflows: [prompt],
    functionalRequirements: [
      {
        id: "REQ-001",
        text: prompt,
        category: "operations",
        priority: "must",
      },
    ],
    nonFunctionalRequirements: ["reliable", "durable"],
    dataModels: [],
    integrations: [],
    securityRequirements: [
      "Do not expose infrastructure credentials to clients",
    ],
    deploymentRequirements:
      productType === "mobile_app" ? ["iOS", "Android", "backend"] : ["web"],
    monetizationRequirements: [],
    selectedTechnologyStack:
      productType === "mobile_app" ? "flutter-node" : "react-node",
    researchRequirements: [],
    runtimeRequirements:
      productType === "mobile_app"
        ? ["Flutter client", "Node backend", "durable background worker"]
        : ["web"],
    secondaryCapabilities: [],
    intentConfidence: 1,
    canonicalInterpretation: prompt,
  };
}

function plan(
  productType: ProductPlan["productType"],
  stack: string,
): ProductPlan {
  return {
    version: 1,
    title: "Background capability product",
    overview: "Product generated through the normal factory path.",
    productType,
    selectedTechnologyStack: stack,
    architecture: {
      summary: "Generated product architecture",
      workflows: ["run recurring background work"],
      personas: ["Customer"],
      roles: ["user"],
      frontendModules: ["Client"],
      backendModules: ["API", "Background worker"],
      databaseModules: [],
      aiModules: [],
      integrationModules: [],
      authenticationDesign: "Not required for this regression.",
      authorizationDesign: "Background jobs validate server-owned inputs.",
      billingDesign: "Not required.",
      deploymentDesign: "Backend worker deployment.",
      operationsDesign: "Durable queue with retries and bounded concurrency.",
      recoveryDesign: "Redis-backed jobs survive worker restarts.",
      monetizationPlan: "Not required.",
    },
    implementationSequence: ["T1"],
    tasks: [
      {
        id: "T1",
        module: "Background work",
        description: "Run durable recurring work.",
        sequence: 1,
        dependencies: [],
        acceptanceCriteria: ["Recurring jobs are durable and idempotent."],
        requirementIds: ["REQ-001"],
        files: ["server/src/background/queue.ts"],
        agent: "backend",
        validations: ["background queue runtime validation"],
      },
    ],
    requirementToTasks: { "REQ-001": ["T1"] },
    taskToFiles: { T1: ["server/src/background/queue.ts"] },
    taskToAgent: { T1: "backend" },
    taskToValidation: { T1: ["background queue runtime validation"] },
    researchDecisionIds: [],
  };
}

describe("generated durable background jobs and scheduling", () => {
  it("adds BullMQ/Redis durable workers and current Job Scheduler support when the canonical mobile contract requires it", () => {
    const mobileContract = contract(
      "Build an iPhone and Android app that monitors availability in the background and checks every five minutes on a recurring schedule.",
    );
    const files = ensureCodeGenerationSupportFiles({
      files: {
        "lib/main.dart": "void main() {}",
        "server/src/server.ts": "export const app = true;",
        "pubspec.yaml":
          "name: customer_app\ndependencies:\n  flutter:\n    sdk: flutter\n",
        "package.json": JSON.stringify({
          name: "customer-backend",
          private: true,
          dependencies: {},
        }),
      },
      contract: mobileContract,
      plan: plan("mobile_app", "flutter-node"),
    });

    const packageJson = JSON.parse(files["package.json"]);
    const apiContract = JSON.parse(files["shared/contracts/product-api.json"]);
    const queueSource = files["server/src/background/queue.ts"];

    expect(packageJson.dependencies).toHaveProperty("bullmq");
    expect(queueSource).toContain("upsertJobScheduler");
    expect(queueSource).toContain("idempotencyKey");
    expect(queueSource).toContain("attempts:");
    expect(queueSource).toContain("backoff:");
    expect(queueSource).toContain("job.id");
    expect(files["server/.env.example"]).toContain("REDIS_URL=");
    expect(apiContract.nativeCapabilities).toMatchObject({
      backgroundJobs: {
        serverImplemented: true,
        durableQueue: true,
        idempotencyRequired: true,
        runtimeVerified: false,
      },
      scheduling: {
        serverImplemented: true,
        schedulerApi: "bullmq-upsertJobScheduler",
        runtimeVerified: false,
      },
    });
  });

  it("does not add a background worker to an ordinary website without a native background requirement", () => {
    const webContract = contract(
      "Build a company website with an about page and contact form.",
      "website",
    );
    const files = ensureCodeGenerationSupportFiles({
      files: {
        "src/main.ts": "export const ready = true;",
        "package.json": JSON.stringify({
          name: "company-site",
          private: true,
          dependencies: {},
        }),
      },
      contract: webContract,
      plan: plan("website", "react-node"),
    });

    expect(files["server/src/background/queue.ts"]).toBeUndefined();
    expect(files["package.json"]).not.toContain("bullmq");
  });
});
