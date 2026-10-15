import { describe, expect, it } from "vitest";
import { ensureCodeGenerationSupportFiles } from "../codeGeneration.js";
import type { ProductContract } from "../productContract.js";
import type { ProductPlan } from "../productPlan.js";

function contract(prompt: string): ProductContract {
  return {
    version: 2,
    originalPrompt: prompt,
    productType: "mobile_app",
    productFamilies: ["frontend", "backend", "mobile", "integrations"],
    targetUsers: ["diners"],
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
    nonFunctionalRequirements: ["secure", "legal"],
    dataModels: ["AvailabilityWatch", "Reservation"],
    integrations: ["authorized restaurant reservation provider"],
    securityRequirements: [
      "Never scrape providers",
      "Booking requires explicit user confirmation",
    ],
    deploymentRequirements: ["iOS", "Android", "backend"],
    monetizationRequirements: [],
    selectedTechnologyStack: "flutter-node",
    researchRequirements: ["authorized reservation provider API"],
    runtimeRequirements: ["Flutter client", "Node backend"],
    secondaryCapabilities: ["external_integrations"],
    intentConfidence: 1,
    canonicalInterpretation: prompt,
  };
}

function plan(): ProductPlan {
  return {
    version: 1,
    title: "Reservation product",
    overview: "Generated reservation product through normal AppForge pipeline.",
    productType: "mobile_app",
    selectedTechnologyStack: "flutter-node",
    architecture: {
      summary: "Flutter + Node + provider adapter",
      workflows: ["check availability", "confirm booking"],
      personas: ["Diner"],
      roles: ["user"],
      frontendModules: ["Mobile client"],
      backendModules: ["Reservation integration"],
      databaseModules: [],
      aiModules: [],
      integrationModules: ["Authorized reservation provider"],
      authenticationDesign: "User account required.",
      authorizationDesign: "Provider credentials remain server-side.",
      billingDesign: "Not required.",
      deploymentDesign: "Mobile and backend.",
      operationsDesign: "Provider failures remain explicit.",
      recoveryDesign: "Idempotent booking requests.",
      monetizationPlan: "Not required.",
    },
    implementationSequence: ["T1"],
    tasks: [
      {
        id: "T1",
        module: "Reservation provider",
        description: "Implement authorized provider boundary.",
        sequence: 1,
        dependencies: [],
        acceptanceCriteria: ["No booking occurs without explicit confirmation."],
        requirementIds: ["REQ-001"],
        files: ["server/src/reservations/provider.ts"],
        agent: "integration",
        validations: ["provider authorization validation"],
      },
    ],
    requirementToTasks: { "REQ-001": ["T1"] },
    taskToFiles: { T1: ["server/src/reservations/provider.ts"] },
    taskToAgent: { T1: "integration" },
    taskToValidation: { T1: ["provider authorization validation"] },
    researchDecisionIds: [],
  };
}

describe("generated authorized reservation-provider support", () => {
  it("adds an authorized provider contract and deterministic sandbox implementation without scraping", () => {
    const files = ensureCodeGenerationSupportFiles({
      files: {
        "lib/main.dart": "void main() {}",
        "server/src/server.ts": "export const app = true;",
        "pubspec.yaml": "name: reservation_app\ndependencies:\n  flutter:\n    sdk: flutter\n",
        "package.json": JSON.stringify({ name: "reservation-backend", private: true }),
      },
      contract: contract(
        "Build an iPhone and Android restaurant availability app using an authorized reservation provider. Monitor table availability and only book after the user explicitly confirms.",
      ),
      plan: plan(),
    });

    const provider = files["server/src/reservations/provider.ts"];
    const sandbox = files["server/src/reservations/sandboxProvider.ts"];
    const registry = files["server/src/reservations/providerRegistry.ts"];
    const apiContract = JSON.parse(files["shared/contracts/product-api.json"]);

    expect(provider).toContain("authorizedSource");
    expect(provider).toContain("confirmedByUser");
    expect(provider).toContain("idempotencyKey");
    expect(sandbox).toContain("SandboxReservationProvider");
    expect(sandbox).toContain("confirmedByUser");
    expect(registry).toContain("RESERVATION_PROVIDER_MODE");
    expect(registry).toContain("sandbox");
    expect(registry).toContain("Production reservation provider is not configured");
    expect(Object.values(files).join("\n")).not.toMatch(/puppeteer|playwright|cheerio|scrape|web.?crawl/i);
    expect(apiContract.reservationProvider).toMatchObject({
      sandboxImplemented: true,
      productionProviderConfigured: false,
      scrapingAllowed: false,
      explicitBookingConfirmationRequired: true,
      runtimeVerified: false,
    });
  });

  it("does not add reservation-provider files to an unrelated mobile product", () => {
    const unrelated = contract("Build a mobile habit tracker with reminders and saved streaks.");
    unrelated.integrations = [];
    unrelated.researchRequirements = [];
    const files = ensureCodeGenerationSupportFiles({
      files: {
        "lib/main.dart": "void main() {}",
        "pubspec.yaml": "name: habit_app\ndependencies:\n  flutter:\n    sdk: flutter\n",
        "package.json": JSON.stringify({ name: "habit-backend", private: true }),
      },
      contract: unrelated,
      plan: plan(),
    });
    expect(files["server/src/reservations/provider.ts"]).toBeUndefined();
  });
});
