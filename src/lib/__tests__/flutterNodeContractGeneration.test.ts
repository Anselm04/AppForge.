import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { ensureCodeGenerationSupportFiles } from "../codeGeneration.js";
import type { ProductContract } from "../productContract.js";
import type { ProductPlan } from "../productPlan.js";

describe("Flutter Node contract-driven generation support", () => {
  it("injects required auth and persistence infrastructure through the normal support-file hook", () => {
    const contract: ProductContract = {
      version: 2,
      originalPrompt: "Build an authenticated mobile app with saved records",
      productType: "mobile_app",
      productFamilies: ["frontend", "backend", "database", "mobile", "auth"],
      targetUsers: ["customers"],
      userRoles: ["user"],
      coreWorkflows: ["sign up", "save records"],
      functionalRequirements: [
        {
          id: "REQ-001",
          text: "Users must create secure accounts and persist their own records.",
          category: "security",
          priority: "must",
        },
      ],
      nonFunctionalRequirements: ["secure"],
      dataModels: ["Record"],
      integrations: ["Supabase"],
      securityRequirements: ["owner scoped records"],
      deploymentRequirements: ["mobile and backend"],
      monetizationRequirements: [],
      selectedTechnologyStack: "flutter-node",
      researchRequirements: [],
      runtimeRequirements: ["Flutter client", "Node backend"],
      secondaryCapabilities: ["authentication", "database"],
      intentConfidence: 1,
      canonicalInterpretation: "Authenticated Flutter and Node product",
    };
    const plan: ProductPlan = {
      version: 1,
      title: "Authenticated mobile product",
      overview:
        "Flutter client with Node backend and owner-scoped persistence.",
      productType: "mobile_app",
      selectedTechnologyStack: "flutter-node",
      architecture: {
        summary: "Flutter + Node + Supabase",
        workflows: ["sign up", "save records"],
        personas: ["Customer"],
        roles: ["user"],
        frontendModules: ["Mobile client"],
        backendModules: ["API"],
        databaseModules: ["Owner records"],
        aiModules: [],
        integrationModules: ["Supabase"],
        authenticationDesign:
          "Supabase publishable-key client with backend JWT verification.",
        authorizationDesign: "RLS owner checks.",
        billingDesign: "Not required.",
        deploymentDesign: "Mobile and backend deployment.",
        operationsDesign: "Health checks.",
        recoveryDesign: "Migration-backed recovery.",
        monetizationPlan: "Not required.",
      },
      implementationSequence: ["T1"],
      tasks: [
        {
          id: "T1",
          module: "Auth and persistence",
          description: "Implement authentication and owner-scoped persistence.",
          sequence: 1,
          dependencies: [],
          acceptanceCriteria: [
            "Auth and persistence are real and owner-scoped.",
          ],
          requirementIds: ["REQ-001"],
          files: ["lib/main.dart", "server/src/server.ts"],
          agent: "backend",
          validations: ["auth persistence validation"],
        },
      ],
      requirementToTasks: { "REQ-001": ["T1"] },
      taskToFiles: { T1: ["lib/main.dart", "server/src/server.ts"] },
      taskToAgent: { T1: "backend" },
      taskToValidation: { T1: ["auth persistence validation"] },
      researchDecisionIds: [],
    };

    const files = ensureCodeGenerationSupportFiles({
      files: {
        "lib/main.dart": "void main() {}",
        "server/src/server.ts": "export const app = true;",
        "pubspec.yaml":
          "name: customer_app\ndependencies:\n  flutter:\n    sdk: flutter\n",
        "package.json": JSON.stringify({
          name: "customer-backend",
          private: true,
        }),
      },
      contract,
      plan,
    });

    const manifest = parse(files["pubspec.yaml"]);
    const apiContract = JSON.parse(files["shared/contracts/product-api.json"]);
    const packageJson = JSON.parse(files["package.json"]);

    expect(manifest.dependencies).toHaveProperty("supabase_flutter");
    expect(packageJson.dependencies).toHaveProperty("@supabase/supabase-js");
    expect(apiContract.authentication).toMatchObject({
      provider: "supabase",
      implemented: true,
      verification: "backend",
    });
    expect(apiContract.database).toMatchObject({
      provider: "supabase-postgres",
      ownerScopedPersistence: true,
      implemented: true,
    });
    expect(files["lib/auth/session.dart"]).toContain("signInWithPassword");
    expect(files["server/src/auth.ts"]).toContain("getClaims");
    expect(files["database/migrations/001_user_data.sql"]).toContain(
      "grant select, insert, update, delete to authenticated",
    );
    expect(files["database/migrations/001_user_data.sql"]).toContain(
      "(select auth.uid()) = user_id",
    );
  });
});
