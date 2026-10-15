import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { ensureCodeGenerationSupportFiles } from "../codeGeneration.js";
import type { ProductContract } from "../productContract.js";
import type { ProductPlan } from "../productPlan.js";

function contract(prompt: string, productType: ProductContract["productType"] = "mobile_app"): ProductContract {
  return {
    version: 2,
    originalPrompt: prompt,
    productType,
    productFamilies:
      productType === "mobile_app"
        ? ["frontend", "backend", "mobile"]
        : ["frontend", "web"],
    targetUsers: ["customers"],
    userRoles: ["user"],
    coreWorkflows: [prompt],
    functionalRequirements: [
      {
        id: "REQ-001",
        text: prompt,
        category: "integration",
        priority: "must",
      },
    ],
    nonFunctionalRequirements: ["secure"],
    dataModels: [],
    integrations: [],
    securityRequirements: ["Do not expose provider credentials to clients"],
    deploymentRequirements:
      productType === "mobile_app" ? ["iOS", "Android"] : ["web"],
    monetizationRequirements: [],
    selectedTechnologyStack:
      productType === "mobile_app" ? "flutter-node" : "react-node",
    researchRequirements: [],
    runtimeRequirements:
      productType === "mobile_app" ? ["Flutter client", "Node backend"] : ["web"],
    secondaryCapabilities: [],
    intentConfidence: 1,
    canonicalInterpretation: prompt,
  };
}

function plan(productType: ProductPlan["productType"], stack: string): ProductPlan {
  return {
    version: 1,
    title: "Capability product",
    overview: "Capability product generated through the normal factory path.",
    productType,
    selectedTechnologyStack: stack,
    architecture: {
      summary: "Generated product architecture",
      workflows: ["receive notification and follow a validated link"],
      personas: ["Customer"],
      roles: ["user"],
      frontendModules: ["Client"],
      backendModules: ["API"],
      databaseModules: [],
      aiModules: [],
      integrationModules: ["Push notifications", "Deep links"],
      authenticationDesign: "Not required for this regression.",
      authorizationDesign: "Validate external navigation input.",
      billingDesign: "Not required.",
      deploymentDesign: "Mobile deployment.",
      operationsDesign: "Fail closed when provider configuration is absent.",
      recoveryDesign: "Keep provider configuration external.",
      monetizationPlan: "Not required.",
    },
    implementationSequence: ["T1"],
    tasks: [
      {
        id: "T1",
        module: "Mobile notifications",
        description: "Receive push notifications and route validated deep links.",
        sequence: 1,
        dependencies: [],
        acceptanceCriteria: ["Notification taps route only through validated links."],
        requirementIds: ["REQ-001"],
        files: ["lib/main.dart"],
        agent: "frontend",
        validations: ["native capability support"],
      },
    ],
    requirementToTasks: { "REQ-001": ["T1"] },
    taskToFiles: { T1: ["lib/main.dart"] },
    taskToAgent: { T1: "frontend" },
    taskToValidation: { T1: ["native capability support"] },
    researchDecisionIds: [],
  };
}

describe("Flutter native push and deep-link generation support", () => {
  it("adds reusable push and deep-link infrastructure only when the canonical mobile contract requires it", () => {
    const mobileContract = contract(
      "Build an iPhone and Android app that sends push notifications and opens the matching screen from the notification deep link.",
    );
    const files = ensureCodeGenerationSupportFiles({
      files: {
        "lib/main.dart": "void main() {}",
        "pubspec.yaml":
          "name: customer_app\ndependencies:\n  flutter:\n    sdk: flutter\n",
        "package.json": JSON.stringify({ name: "customer-backend", private: true }),
      },
      contract: mobileContract,
      plan: plan("mobile_app", "flutter-node"),
    });

    const manifest = parse(files["pubspec.yaml"]);
    const apiContract = JSON.parse(files["shared/contracts/product-api.json"]);

    expect(manifest.dependencies).toMatchObject({
      app_links: expect.any(String),
      firebase_core: expect.any(String),
      firebase_messaging: expect.any(String),
    });
    expect(files["lib/platform/deep_links.dart"]).toContain("allowedHost");
    expect(files["lib/platform/deep_links.dart"]).toContain("uriLinkStream");
    expect(files["lib/platform/push_notifications.dart"]).toContain(
      "FirebaseMessaging.onMessageOpenedApp",
    );
    expect(files["lib/platform/push_notifications.dart"]).toContain(
      "FIREBASE_MESSAGING_SENDER_ID",
    );
    expect(files["lib/platform/push_notifications.dart"]).not.toMatch(
      /serverKey|serviceAccount|privateKey/i,
    );
    expect(files[".env.example"]).toContain("APP_LINK_HOST=");
    expect(files[".env.example"]).toContain("FIREBASE_PROJECT_ID=");
    expect(apiContract.nativeCapabilities).toMatchObject({
      deepLinks: {
        clientImplemented: true,
        hostAllowlistRequired: true,
      },
      pushNotifications: {
        clientImplemented: true,
        providerCredentialsRequired: true,
        providerCredentialsBundledInClient: false,
      },
    });
  });

  it("does not add native notification dependencies to an ordinary web product", () => {
    const webContract = contract(
      "Build a company website with a contact form and notification banner.",
      "website",
    );
    const files = ensureCodeGenerationSupportFiles({
      files: {
        "src/main.ts": "export const ready = true;",
        "package.json": JSON.stringify({ name: "company-site", private: true }),
      },
      contract: webContract,
      plan: plan("website", "react-node"),
    });

    expect(files["lib/platform/deep_links.dart"]).toBeUndefined();
    expect(files["lib/platform/push_notifications.dart"]).toBeUndefined();
    expect(files["package.json"]).not.toContain("firebase_messaging");
  });
});
