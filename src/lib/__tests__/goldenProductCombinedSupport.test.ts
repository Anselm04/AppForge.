import { describe, expect, it } from "vitest";
import { ensureCodeGenerationSupportFiles } from "../codeGeneration.js";
import { resolveIntakeContract } from "../productContract.js";
import type { ProductPlan } from "../productPlan.js";

const GOLDEN_PROMPT = [
  "Build an iPhone and Android restaurant table availability app.",
  "Users sign up and sign in, save restaurant watches in a database, choose preferred dates, time ranges and party sizes,",
  "monitor authorized reservation-provider API availability in the background on a recurring schedule,",
  "receive push notifications with deep links when a match appears, use hands-free voice commands with spoken replies,",
  "and only book a table after the user explicitly confirms.",
  "Charge $9.99 per month through Stripe with server-authoritative paid entitlements.",
  "Include analytics, privacy and terms, a secure backend, source export, and deployment configuration.",
].join(" ");

function planFor(requirementIds: string[]): ProductPlan {
  const taskId = "GOLDEN-001";
  return {
    version: 1,
    title: "Golden Product acceptance fixture",
    overview: "Normal Flutter + Node Golden Product capability acceptance.",
    productType: "mobile_app",
    selectedTechnologyStack: "flutter-node",
    architecture: {
      summary: "Flutter client, Node backend and external capability adapters.",
      workflows: ["watch availability", "notify", "confirm booking"],
      personas: ["Diner"],
      roles: ["user"],
      frontendModules: ["Mobile client"],
      backendModules: ["API", "Background worker"],
      databaseModules: ["User watches", "Entitlements"],
      aiModules: [],
      integrationModules: ["Stripe", "Authorized reservation provider"],
      authenticationDesign: "Secure user accounts.",
      authorizationDesign:
        "Owner-scoped records and server-side protected actions.",
      billingDesign: "Stripe test-mode entitlements.",
      deploymentDesign: "iOS, Android and Node backend.",
      operationsDesign:
        "Durable background scheduling and explicit failure handling.",
      recoveryDesign: "Idempotent jobs, webhooks and booking requests.",
      monetizationPlan: "$9.99 monthly subscription.",
    },
    implementationSequence: [taskId],
    tasks: [
      {
        id: taskId,
        module: "Golden Product",
        description: "Implement the canonical Golden Product requirements.",
        sequence: 1,
        dependencies: [],
        acceptanceCriteria: [
          "All requested generated capability layers are present.",
        ],
        requirementIds,
        files: ["lib/main.dart", "server/src/server.ts"],
        agent: "integration",
        validations: ["combined capability acceptance"],
      },
    ],
    requirementToTasks: Object.fromEntries(
      requirementIds.map((id) => [id, [taskId]]),
    ),
    taskToFiles: { [taskId]: ["lib/main.dart", "server/src/server.ts"] },
    taskToAgent: { [taskId]: "integration" },
    taskToValidation: { [taskId]: ["combined capability acceptance"] },
    researchDecisionIds: [],
  } as ProductPlan;
}

describe("Golden Product combined normal-pipeline support", () => {
  it("emits every implemented capability layer together from one normal nontechnical prompt", () => {
    const intake = resolveIntakeContract(GOLDEN_PROMPT);
    expect(intake.ok).toBe(true);
    if (!intake.ok) return;

    const contract = intake.productContract;
    expect(contract.selectedTechnologyStack).toBe("flutter-node");
    const plan = planFor(
      contract.functionalRequirements.map((requirement) => requirement.id),
    );

    const files = ensureCodeGenerationSupportFiles({
      files: {
        "lib/main.dart": "void main() {}",
        "server/src/server.ts": "export const app = true;",
        "pubspec.yaml":
          "name: golden_product\ndependencies:\n  flutter:\n    sdk: flutter\n",
        "package.json": JSON.stringify({
          name: "golden-product-backend",
          private: true,
          dependencies: {},
        }),
      },
      contract,
      plan,
    });

    const packageJson = JSON.parse(files["package.json"]);
    const api = JSON.parse(files["shared/contracts/product-api.json"]);

    expect(files["lib/auth/session.dart"]).toContain("signInWithPassword");
    expect(files["database/migrations/001_user_data.sql"]).toContain(
      "auth.uid()",
    );

    expect(files["lib/platform/deep_links.dart"]).toContain("allowedHost");
    expect(files["lib/platform/push_notifications.dart"]).toContain(
      "FirebaseMessaging.onMessageOpenedApp",
    );

    expect(files["server/src/background/queue.ts"]).toContain(
      "upsertJobScheduler",
    );
    expect(packageJson.dependencies.bullmq).toBeTruthy();

    expect(files["lib/platform/voice_interaction.dart"]).toContain(
      "parseExplicitConfirmation",
    );
    expect(files["lib/platform/voice_interaction.dart"]).not.toContain(
      "book it",
    );

    expect(files["server/src/billing/stripe.ts"]).toContain("sk_test_");
    expect(files["server/src/billing/stripe.ts"]).toContain("constructEvent");
    expect(files["server/src/billing/entitlements.ts"]).toContain("BEGIN");
    expect(files["database/migrations/002_billing_entitlements.sql"]).toContain(
      "stripe_webhook_events",
    );

    expect(files["server/src/reservations/provider.ts"]).toContain(
      "confirmedByUser",
    );
    expect(files["server/src/reservations/sandboxProvider.ts"]).toContain(
      "SandboxReservationProvider",
    );
    expect(files["server/src/reservations/providerRegistry.ts"]).toContain(
      "Production reservation provider is not configured",
    );

    expect(api.authentication).toMatchObject({ implemented: true });
    expect(api.database).toMatchObject({ implemented: true });
    expect(api.nativeCapabilities).toMatchObject({
      pushNotifications: { clientImplemented: true, runtimeVerified: false },
      deepLinks: { clientImplemented: true, runtimeVerified: false },
      backgroundJobs: { serverImplemented: true, runtimeVerified: false },
      scheduling: { serverImplemented: true, runtimeVerified: false },
      speechRecognition: { clientImplemented: true, runtimeVerified: false },
      textToSpeech: { clientImplemented: true, runtimeVerified: false },
      microphone: { clientImplemented: true, runtimeVerified: false },
    });
    expect(api.billing).toMatchObject({
      provider: "stripe",
      testModeOnly: true,
      serverAuthoritative: true,
      runtimeVerified: false,
    });
    expect(api.reservationProvider).toMatchObject({
      sandboxImplemented: true,
      productionProviderConfigured: false,
      scrapingAllowed: false,
      explicitBookingConfirmationRequired: true,
      runtimeVerified: false,
    });
  });
});
