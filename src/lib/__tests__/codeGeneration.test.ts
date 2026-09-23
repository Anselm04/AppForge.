import { describe, expect, it } from "vitest";
import {
  buildImplementationEvidence,
  coderTaskInstruction,
  ensureCodeGenerationSupportFiles,
  validateCoderOwnedArtifact,
  validateCoderTaskOutput,
  validateGeneratedCodeArtifact,
} from "../codeGeneration.js";
import {
  validateProductContract,
  type ProductContract,
} from "../productContract.js";
import {
  validateProductPlan,
  type ProductPlan,
} from "../productPlan.js";

function fixture(): {
  contract: ProductContract;
  plan: ProductPlan;
} {
  const contract = validateProductContract({
    version: 2,
    originalPrompt:
      "Build a SaaS application with authentication, database storage and Stripe billing",
    productType: "saas_application",
    productFamilies: [
      "frontend",
      "backend",
      "database",
      "billing",
      "auth",
      "deployment",
    ],
    targetUsers: ["Customers", "Administrators"],
    userRoles: ["user", "admin"],
    coreWorkflows: ["Sign in", "Use dashboard", "Manage subscription"],
    functionalRequirements: [
      {
        id: "REQ-001",
        text: "Implement the primary workflow.",
        category: "workflow",
        priority: "must",
      },
      {
        id: "REQ-002",
        text: "Provide loading, empty, success and error states.",
        category: "quality",
        priority: "must",
      },
      {
        id: "REQ-003",
        text: "Keep credentials server-side.",
        category: "security",
        priority: "must",
      },
      {
        id: "REQ-004",
        text: "Enforce paid entitlements server-side.",
        category: "monetization",
        priority: "must",
      },
      {
        id: "REQ-005",
        text: "Provide build and runtime startup behavior.",
        category: "operations",
        priority: "must",
      },
    ],
    nonFunctionalRequirements: [
      "Production-safe errors",
      "Accessible UI",
      "Deterministic build",
      "No placeholders",
    ],
    dataModels: ["User", "Subscription"],
    integrations: ["Stripe"],
    securityRequirements: ["No client secrets"],
    deploymentRequirements: ["Health verified deployment"],
    monetizationRequirements: ["Server-authoritative entitlement"],
    selectedTechnologyStack: "react-node",
    researchRequirements: ["Use official React documentation"],
    runtimeRequirements: ["Use React and Node runtime"],
    secondaryCapabilities: [
      "authentication",
      "database",
      "billing",
      "deployment",
    ],
    intentConfidence: 0.95,
    canonicalInterpretation: "Build one React + Node SaaS product.",
  });

  const plan = validateProductPlan(
    {
      version: 1,
      title: "Production SaaS",
      overview: "A real authenticated subscription application.",
      productType: "saas_application",
      selectedTechnologyStack: "react-node",
      architecture: {
        summary: "React frontend with Node service boundaries.",
        workflows: ["Sign in", "Use dashboard", "Manage subscription"],
        personas: ["Customer", "Administrator"],
        roles: ["user", "admin"],
        frontendModules: ["Application shell"],
        backendModules: ["Auth and billing API"],
        databaseModules: ["Persistence"],
        aiModules: [],
        integrationModules: ["Stripe"],
        authenticationDesign: "Server-authoritative sessions.",
        authorizationDesign: "Server-side role and ownership checks.",
        billingDesign: "Stripe webhook-backed entitlements.",
        deploymentDesign: "Build and deploy validated artifact.",
        operationsDesign: "Health and errors.",
        recoveryDesign: "Retry-safe operations.",
        monetizationPlan: "Subscription access.",
      },
      implementationSequence: ["T1", "T2"],
      tasks: [
        {
          id: "T1",
          module: "Application",
          description: "Implement frontend entrypoints and states.",
          sequence: 1,
          dependencies: [],
          acceptanceCriteria: ["Dashboard handles all visible states."],
          requirementIds: ["REQ-001", "REQ-002"],
          files: ["src/main.tsx", "src/App.tsx"],
          agent: "frontend",
          validations: ["UI workflow tests"],
        },
        {
          id: "T2",
          module: "Runtime",
          description: "Implement runtime configuration and documentation.",
          sequence: 2,
          dependencies: ["T1"],
          acceptanceCriteria: ["Runtime is documented and secure."],
          requirementIds: ["REQ-003", "REQ-004", "REQ-005"],
          files: [".env.example", "README.md"],
          agent: "operations",
          validations: ["runtime checks"],
        },
      ],
      requirementToTasks: {
        "REQ-001": ["T1"],
        "REQ-002": ["T1"],
        "REQ-003": ["T2"],
        "REQ-004": ["T2"],
        "REQ-005": ["T2"],
      },
      taskToFiles: {
        T1: ["src/main.tsx", "src/App.tsx"],
        T2: [".env.example", "README.md"],
      },
      taskToAgent: { T1: "frontend", T2: "operations" },
      taskToValidation: {
        T1: ["UI workflow tests"],
        T2: ["runtime checks"],
      },
      researchDecisionIds: ["RD-001"],
    },
    contract,
  );

  return { contract, plan };
}

describe("code generation guard", () => {
  it("builds a contract-aware task instruction with real behavior rules", () => {
    const { contract, plan } = fixture();
    const instruction = coderTaskInstruction({
      contract,
      plan,
      task: plan.tasks[0],
      researchDecisions: [
        {
          id: "RD-001",
          category: "framework",
          decision: "Use supported React runtime.",
          rationale: "Official documentation.",
          sourceUrls: [],
          confidence: "high",
        },
      ],
    });

    expect(instruction).toContain("Task files (ALL must be returned as complete files)");
    expect(instruction).toContain("loading, empty, success, and error states");
    expect(instruction).toContain("Authentication must implement real sign-in/session/error behavior");
    expect(instruction).toContain("// requirement: REQ-001");
    expect(instruction).toContain("RD-001");
  });

  it("accepts complete requirement-linked task files", () => {
    const { contract, plan } = fixture();
    expect(() =>
      validateCoderTaskOutput({
        contract,
        task: plan.tasks[0],
        files: {
          "src/main.tsx":
            'import { App } from "./App";\n// requirement: REQ-001\n// requirement: REQ-002\nconsole.log(App);',
          "src/App.tsx":
            'export function App(){ const loading=false; const error=null; return <main>{loading ? "Loading" : error ? "Error" : "Ready"}</main>; }',
        },
      }),
    ).not.toThrow();
  });

  it("rejects omitted files, placeholders, empty handlers and wrong-stack output", () => {
    const { contract, plan } = fixture();

    expect(() =>
      validateCoderTaskOutput({
        contract,
        task: plan.tasks[0],
        files: {
          "src/main.tsx": "// requirement: REQ-001\n// TODO\nexport const x = 1;",
        },
      }),
    ).toThrow(/omitted planned complete file/);

    expect(() =>
      validateCoderTaskOutput({
        contract,
        task: plan.tasks[0],
        files: {
          "src/main.tsx":
            "// requirement: REQ-001\n// requirement: REQ-002\nexport const click = () => {};",
          "src/App.tsx": "export const App = () => <main>Ready</main>;",
        },
      }),
    ).toThrow(/empty handler/);
  });

  it("requires coder-owned runtime entrypoints, environment examples and documentation", () => {
    const { contract } = fixture();
    const problems = validateCoderOwnedArtifact({
      contract,
      files: {
        "src/main.tsx": "export const boot = true;",
      },
    });
    expect(problems).toContain("Coder omitted runtime entrypoint src/App.tsx");
    expect(problems).toContain("Coder omitted environment example .env.example");
    expect(problems).toContain("Coder omitted README.md documentation");
  });

  it("creates requirement-linked implementation evidence without replacing substantive docs", () => {
    const { contract, plan } = fixture();
    const files = ensureCodeGenerationSupportFiles({
      contract,
      plan,
      files: {
        "src/main.tsx": "export const boot = true;",
        "src/App.tsx": "export const App = () => <main>Ready</main>;",
        ".env.example": "API_URL=\n",
        "README.md": "# Custom product docs\n",
      },
    });

    const evidence = JSON.parse(files["appforge.implementation.json"]);
    expect(evidence.selectedTechnologyStack).toBe("react-node");
    expect(evidence.requirements[0].files).toContain("src/App.tsx");
    expect(files["README.md"]).toBe("# Custom product docs\n");
  });

  it("fails the final code-generation artifact if a planned file disappears", () => {
    const { contract, plan } = fixture();
    const evidence = buildImplementationEvidence({ contract, plan });
    const problems = validateGeneratedCodeArtifact({
      contract,
      plan,
      files: {
        "src/main.tsx":
          "// requirement: REQ-001\n// requirement: REQ-002\nexport const boot = true;",
        ".env.example": "API_URL=\n",
        "README.md": "# Docs",
        "appforge.implementation.json": evidence,
      },
    });

    expect(problems).toContain(
      "planned generated file disappeared before validation: src/App.tsx",
    );
  });
});
