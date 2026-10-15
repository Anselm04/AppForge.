import { describe, expect, it } from "vitest";
import { ensureCodeGenerationSupportFiles } from "../codeGeneration.js";
import type { ProductContract } from "../productContract.js";
import type { ProductPlan } from "../productPlan.js";

function contract(prompt: string): ProductContract {
  return {
    version: 2,
    originalPrompt: prompt,
    productType: "mobile_app",
    productFamilies: ["frontend", "backend", "mobile"],
    targetUsers: ["customers"],
    userRoles: ["user"],
    coreWorkflows: [prompt],
    functionalRequirements: [
      {
        id: "REQ-001",
        text: prompt,
        category: "workflow",
        priority: "must",
      },
    ],
    nonFunctionalRequirements: ["accessible", "secure"],
    dataModels: [],
    integrations: [],
    securityRequirements: [
      "Microphone access requires explicit permission",
      "Irreversible actions require explicit user confirmation",
    ],
    deploymentRequirements: ["iOS", "Android"],
    monetizationRequirements: [],
    selectedTechnologyStack: "flutter-node",
    researchRequirements: [],
    runtimeRequirements: ["Flutter client", "Node backend"],
    secondaryCapabilities: [],
    intentConfidence: 1,
    canonicalInterpretation: prompt,
  };
}

function plan(): ProductPlan {
  return {
    version: 1,
    title: "Voice capability product",
    overview: "Generated mobile voice capability fixture.",
    productType: "mobile_app",
    selectedTechnologyStack: "flutter-node",
    architecture: {
      summary: "Flutter + Node",
      workflows: ["listen for a short command and speak a response"],
      personas: ["Customer"],
      roles: ["user"],
      frontendModules: ["Voice UI"],
      backendModules: ["API"],
      databaseModules: [],
      aiModules: [],
      integrationModules: [],
      authenticationDesign: "Not required for this regression.",
      authorizationDesign: "Protected actions require confirmation.",
      billingDesign: "Not required.",
      deploymentDesign: "iOS and Android.",
      operationsDesign: "Voice failures surface explicitly.",
      recoveryDesign: "Voice sessions can be stopped and restarted.",
      monetizationPlan: "Not required.",
    },
    implementationSequence: ["T1"],
    tasks: [
      {
        id: "T1",
        module: "Voice interaction",
        description: "Implement speech recognition and spoken responses.",
        sequence: 1,
        dependencies: [],
        acceptanceCriteria: [
          "Voice input and TTS fail closed on permission or runtime failure.",
        ],
        requirementIds: ["REQ-001"],
        files: ["lib/platform/voice_interaction.dart"],
        agent: "frontend",
        validations: ["voice runtime validation"],
      },
    ],
    requirementToTasks: { "REQ-001": ["T1"] },
    taskToFiles: { T1: ["lib/platform/voice_interaction.dart"] },
    taskToAgent: { T1: "frontend" },
    taskToValidation: { T1: ["voice runtime validation"] },
    researchDecisionIds: [],
  };
}

describe("generated Flutter voice interaction support", () => {
  it("adds speech recognition, TTS and microphone support only when the canonical contract requires voice interaction", () => {
    const files = ensureCodeGenerationSupportFiles({
      files: {
        "lib/main.dart": "void main() {}",
        "pubspec.yaml":
          "name: customer_app\ndependencies:\n  flutter:\n    sdk: flutter\n",
        "package.json": JSON.stringify({
          name: "customer-backend",
          private: true,
        }),
      },
      contract: contract(
        "Build an iPhone and Android app with hands-free voice commands and spoken replies.",
      ),
      plan: plan(),
    });

    expect(files["pubspec.yaml"]).toContain("speech_to_text");
    expect(files["pubspec.yaml"]).toContain("flutter_tts");
    expect(files["lib/platform/voice_interaction.dart"]).toContain(
      "SpeechListenOptions",
    );
    expect(files["lib/platform/voice_interaction.dart"]).toContain(
      "awaitSpeakCompletion",
    );
    expect(files["lib/platform/voice_interaction.dart"]).toContain(
      "parseExplicitConfirmation",
    );
    expect(files["lib/platform/voice_interaction.dart"]).not.toContain(
      "book it",
    );

    const apiContract = JSON.parse(files["shared/contracts/product-api.json"]);
    expect(apiContract.nativeCapabilities).toMatchObject({
      speechRecognition: {
        clientImplemented: true,
        microphonePermissionRequired: true,
        runtimeVerified: false,
      },
      textToSpeech: {
        clientImplemented: true,
        runtimeVerified: false,
      },
      microphone: {
        clientImplemented: true,
        explicitPermissionRequired: true,
        runtimeVerified: false,
      },
    });
  });

  it("does not add voice dependencies to a mobile product that never requests voice", () => {
    const files = ensureCodeGenerationSupportFiles({
      files: {
        "lib/main.dart": "void main() {}",
        "pubspec.yaml":
          "name: customer_app\ndependencies:\n  flutter:\n    sdk: flutter\n",
        "package.json": JSON.stringify({
          name: "customer-backend",
          private: true,
        }),
      },
      contract: contract(
        "Build a mobile product with a dashboard and saved settings.",
      ),
      plan: plan(),
    });

    expect(files["lib/platform/voice_interaction.dart"]).toBeUndefined();
    expect(files["pubspec.yaml"]).not.toContain("speech_to_text");
    expect(files["pubspec.yaml"]).not.toContain("flutter_tts");
  });
});
