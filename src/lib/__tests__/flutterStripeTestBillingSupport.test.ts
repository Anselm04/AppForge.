import { describe, expect, it } from "vitest";
import { ensureCodeGenerationSupportFiles } from "../codeGeneration.js";
import type { ProductContract } from "../productContract.js";
import type { ProductPlan } from "../productPlan.js";

function contract(monetized: boolean): ProductContract {
  const prompt = monetized
    ? "Build an iPhone and Android app with a $9.99 monthly Stripe subscription and server-authoritative paid access."
    : "Build an iPhone and Android app with saved settings.";
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
        category: "monetization",
        priority: "must",
      },
    ],
    nonFunctionalRequirements: ["secure"],
    dataModels: monetized ? ["Entitlement", "BillingEvent"] : [],
    integrations: monetized ? ["Stripe"] : [],
    securityRequirements: ["Paid access must be server-authoritative"],
    deploymentRequirements: ["iOS", "Android", "backend"],
    monetizationRequirements: monetized
      ? ["$9.99 monthly subscription through Stripe"]
      : [],
    selectedTechnologyStack: "flutter-node",
    researchRequirements: [],
    runtimeRequirements: ["Flutter client", "Node backend"],
    secondaryCapabilities: monetized ? ["billing"] : [],
    intentConfidence: 1,
    canonicalInterpretation: prompt,
  };
}

function plan(): ProductPlan {
  return {
    version: 1,
    title: "Subscription product",
    overview: "Flutter client with Node backend.",
    productType: "mobile_app",
    selectedTechnologyStack: "flutter-node",
    architecture: {
      summary: "Flutter + Node",
      workflows: ["subscribe", "enforce entitlement"],
      personas: ["Customer"],
      roles: ["user"],
      frontendModules: ["Mobile client"],
      backendModules: ["Billing API"],
      databaseModules: ["Entitlements"],
      aiModules: [],
      integrationModules: ["Stripe"],
      authenticationDesign: "Authenticated user identity.",
      authorizationDesign: "Server entitlement gate.",
      billingDesign: "Stripe test-mode checkout and verified webhooks.",
      deploymentDesign: "Mobile and backend.",
      operationsDesign: "Webhook event audit ledger.",
      recoveryDesign: "Idempotent event replay.",
      monetizationPlan: "$9.99 monthly subscription.",
    },
    implementationSequence: ["T1"],
    tasks: [
      {
        id: "T1",
        module: "Billing",
        description: "Implement Stripe test checkout and entitlements.",
        sequence: 1,
        dependencies: [],
        acceptanceCriteria: ["Paid access is server-authoritative."],
        requirementIds: ["REQ-001"],
        files: ["server/src/billing/stripe.ts"],
        agent: "integration",
        validations: ["billing validation"],
      },
    ],
    requirementToTasks: { "REQ-001": ["T1"] },
    taskToFiles: { T1: ["server/src/billing/stripe.ts"] },
    taskToAgent: { T1: "integration" },
    taskToValidation: { T1: ["billing validation"] },
    researchDecisionIds: [],
  };
}

describe("generated Stripe test-mode billing and entitlements", () => {
  it("adds test-mode-only checkout, verified webhooks, durable event deduplication and server entitlements", () => {
    const files = ensureCodeGenerationSupportFiles({
      files: {
        "lib/main.dart": "void main() {}",
        "server/src/server.ts": "export const app = true;",
        "pubspec.yaml": "name: customer_app\ndependencies:\n  flutter:\n    sdk: flutter\n",
        "package.json": JSON.stringify({ name: "customer-backend", private: true, dependencies: {} }),
      },
      contract: contract(true),
      plan: plan(),
    });

    const packageJson = JSON.parse(files["package.json"]);
    const apiContract = JSON.parse(files["shared/contracts/product-api.json"]);
    expect(packageJson.dependencies.stripe).toMatch(/^\^23\./);
    expect(packageJson.dependencies.pg).toBeTruthy();
    expect(files["server/.env.example"]).toContain("STRIPE_SECRET_KEY=");
    expect(files["server/.env.example"]).toContain("STRIPE_WEBHOOK_SECRET=");
    expect(files["server/src/billing/stripe.ts"]).toContain("sk_test_");
    expect(files["server/src/billing/stripe.ts"]).toContain("constructEvent");
    expect(files["server/src/billing/stripe.ts"]).toContain("client_reference_id");
    expect(files["server/src/billing/entitlements.ts"]).toContain("BEGIN");
    expect(files["server/src/billing/entitlements.ts"]).toContain("ON CONFLICT");
    expect(files["database/migrations/002_billing_entitlements.sql"]).toContain("stripe_webhook_events");
    expect(files["database/migrations/002_billing_entitlements.sql"]).toContain("billing_entitlements");
    expect(files["database/migrations/002_billing_entitlements.sql"]).toContain("revoke all");
    expect(files["docs/BILLING.md"]).toContain("test mode");
    expect(files["lib/main.dart"]).not.toContain("STRIPE_SECRET_KEY");
    expect(apiContract.billing).toMatchObject({
      provider: "stripe",
      testModeOnly: true,
      serverAuthoritative: true,
      webhookSignatureRequired: true,
      runtimeVerified: false,
    });
  });

  it("does not add Stripe to a product with no monetization requirement", () => {
    const files = ensureCodeGenerationSupportFiles({
      files: {
        "lib/main.dart": "void main() {}",
        "pubspec.yaml": "name: customer_app\ndependencies:\n  flutter:\n    sdk: flutter\n",
        "package.json": JSON.stringify({ name: "customer-backend", private: true, dependencies: {} }),
      },
      contract: contract(false),
      plan: plan(),
    });
    expect(files["server/src/billing/stripe.ts"]).toBeUndefined();
    expect(files["package.json"]).not.toContain('"stripe"');
  });
});
