import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildProductContract,
  classifyProductIntent,
  detectSecondaryCapabilities,
  type ProductType,
} from "../lib/productContract.js";
import {
  getStackScaffold,
  validateStackScaffold,
} from "../services/stackScaffolds.js";
import { recoveryGuidance } from "../services/recovery.js";
import { validateCoderTaskOutput } from "../lib/codeGeneration.js";
import type { ProductPlanTask } from "../lib/productPlan.js";

type ProductRegressionCase = {
  label: string;
  prompt: string;
  productType: ProductType;
};

const PRODUCT_GENERATION_CASES: ProductRegressionCase[] = [
  {
    label: "website",
    prompt: "Build a public marketing website for a carving studio",
    productType: "website",
  },
  {
    label: "SaaS",
    prompt:
      "Build a multi-tenant SaaS CRM for contractors with team accounts and dashboards",
    productType: "saas_application",
  },
  {
    label: "e-commerce",
    prompt:
      "Build an e-commerce storefront for handmade products with cart and checkout",
    productType: "ecommerce_product",
  },
  {
    label: "AI-agent",
    prompt:
      "Build an AI agent that researches documents, uses tools, and drafts replies",
    productType: "ai_agent",
  },
  {
    label: "API",
    prompt: "Build a REST API for bookings with OpenAPI documentation",
    productType: "api",
  },
  {
    label: "browser-extension",
    prompt:
      "Build a Chrome browser extension that summarizes the current page",
    productType: "browser_extension",
  },
  {
    label: "data-product",
    prompt:
      "Build a data product with an analytics dashboard for CSV sales data",
    productType: "data_product",
  },
  {
    label: "automation",
    prompt:
      "Build a workflow automation tool that syncs CRM records every night",
    productType: "automation_tool",
  },
  {
    label: "mobile-app",
    prompt: "Build an iPhone and Android mobile app for field inspections",
    productType: "mobile_app",
  },
  {
    label: "desktop-app",
    prompt:
      "Build a desktop app with Electron for offline inventory management",
    productType: "desktop_app",
  },
  {
    label: "game",
    prompt: "Build a browser platformer game with levels and scoring",
    productType: "game",
  },
];

describe("#28 Regression Coverage", () => {
  it.each(PRODUCT_GENERATION_CASES)(
    "keeps the $label generation path contract and stack-valid",
    ({ prompt, productType }) => {
      const contract = buildProductContract(prompt);
      expect(contract.productType).toBe(productType);
      expect(contract.selectedTechnologyStack).toBeTruthy();
      expect(contract.functionalRequirements.length).toBeGreaterThan(0);

      const scaffold = getStackScaffold(
        contract.selectedTechnologyStack,
        contract.productType,
      );
      expect(
        validateStackScaffold(contract.selectedTechnologyStack, scaffold),
      ).toEqual([]);
    },
  );

  it("covers a monetized full-stack SaaS path", () => {
    const contract = buildProductContract(
      "Build a multi-tenant SaaS web app with login, PostgreSQL database, Stripe subscriptions, admin dashboard, and production deployment",
    );

    expect(contract.productType).toBe("saas_application");
    expect(contract.productFamilies).toEqual(
      expect.arrayContaining([
        "frontend",
        "backend",
        "auth",
        "database",
        "billing",
      ]),
    );
    expect(contract.secondaryCapabilities).toEqual(
      expect.arrayContaining([
        "authentication",
        "database",
        "billing",
        "administration",
        "deployment",
      ]),
    );
    expect(contract.monetizationRequirements.length).toBeGreaterThan(0);
  });

  it(
    "covers a multi-capability product without dropping requested capabilities",
    () => {
    const prompt =
      "Build a SaaS application with login, PostgreSQL database, Stripe billing, AI assistant, analytics, admin console, teams, notifications, search, file uploads, Slack integration, and production deployment";
    expect(detectSecondaryCapabilities(prompt)).toEqual([
      "authentication",
      "database",
      "billing",
      "ai",
      "analytics",
      "administration",
      "teams",
      "notifications",
      "search",
      "file_uploads",
      "external_integrations",
      "deployment",
    ]);
  });

  it("keeps ambiguous prompts in clarification instead of guessing", () => {
    const intent = classifyProductIntent(
      "Build something useful for my business",
    );
    expect(intent.ambiguous).toBe(true);
    expect(intent.primaryProductType).toBeNull();
    expect(intent.clarificationQuestions.length).toBeGreaterThan(0);
  });

  it("handles a short but resolvable prompt", () => {
    const contract = buildProductContract("REST API");
    expect(contract.productType).toBe("api");
    expect(contract.originalPrompt).toBe("REST API");
  });

  it("handles a long prompt without truncating the canonical input", () => {
    const details = [
      "Users need login, team workspaces, PostgreSQL persistence, Stripe subscriptions, analytics, notifications, search, file uploads, and production deployment.",
      "Every workflow needs loading, empty, success, validation, permission, and provider-failure behavior.",
      "Administrators need auditable controls and users need a clear recovery path.",
    ].join(" ");
    const prompt =
      "Build a multi-tenant SaaS application for service businesses. " +
      Array.from({ length: 30 }, () => details).join(" ");

    const contract = buildProductContract(prompt);
    expect(contract.productType).toBe("saas_application");
    expect(contract.originalPrompt).toBe(prompt);
    expect(contract.originalPrompt.length).toBeGreaterThan(5_000);
  });

  it(
    "creates explicit research requirements including integration documentation",
    () => {
    const contract = buildProductContract(
      "Build a SaaS application with Slack integration and production deployment",
    );
    expect(contract.researchRequirements.length).toBeGreaterThan(0);
    expect(contract.researchRequirements.join("\n")).toMatch(
      /official documentation|Slack API and SDK documentation/i,
    );
  });

  it("marks external integrations as required when requested", () => {
    const contract = buildProductContract(
      "Build a SaaS CRM that integrates with Slack and HubSpot",
    );
    expect(contract.secondaryCapabilities).toContain("external_integrations");
    expect(contract.integrations.length).toBeGreaterThan(0);
  });

  it("marks authentication as required when requested", () => {
    const contract = buildProductContract(
      "Build a SaaS project manager with login, password reset, and team accounts",
    );
    expect(contract.secondaryCapabilities).toContain("authentication");
    expect(contract.productFamilies).toContain("auth");
  });

  it("marks monetization as required when requested", () => {
    const contract = buildProductContract(
      "Build a paid SaaS app with Stripe subscriptions and pricing plans",
    );
    expect(contract.secondaryCapabilities).toContain("billing");
    expect(contract.productFamilies).toContain("billing");
    expect(contract.monetizationRequirements.length).toBeGreaterThan(0);
  });

  it.each([
    [
      "failed-provider recovery",
      "provider_failure" as const,
      "pause_refund_and_retry_after_provider_recovery",
      false,
    ],
    [
      "failed-build recovery",
      "build_interrupted" as const,
      "retry_or_resume_without_promoting_partial_generation",
      true,
    ],
    [
      "failed-deployment recovery",
      "deployment_failure" as const,
      "bounded_retry_then_keep_previous_verified_deployment",
      true,
    ],
  ])(
    "covers %s without losing the known-good state",
    (_label, kind, action, automatic) => {
      const guidance = recoveryGuidance(kind);
      expect(guidance.action).toBe(action);
      expect(guidance.automatic).toBe(automatic);
      expect(guidance.preservesKnownGood).toBe(true);
    },
  );

  it("keeps generated previews isolated from the AppForge origin", () => {
    const livePreview = readFileSync("src/routes/livePreview.ts", "utf8");
    const hostedApps = readFileSync("src/routes/hostedApps.ts", "utf8");
    const sandboxPolicy =
      "sandbox allow-scripts allow-forms allow-modals allow-popups";

    for (const source of [livePreview, hostedApps]) {
      expect(source).toContain(sandboxPolicy);
      expect(source).not.toContain("sandbox allow-same-origin");
      expect(source).toContain('res.setHeader("Cache-Control", "no-store")');
      expect(source).toContain(
        'res.setHeader("Referrer-Policy", "no-referrer")',
      );
    }
  });

  it("rejects placeholder-only generated artifacts", () => {
    const contract = buildProductContract(
      "Build a public marketing website for a carving studio",
    );
    const requirementId = contract.functionalRequirements[0]!.id;
    const task: ProductPlanTask = {
      id: "T1",
      module: "website",
      description: "Implement the primary website workflow",
      sequence: 1,
      dependencies: [],
      acceptanceCriteria: ["The website renders substantive product content"],
      requirementIds: [requirementId],
      files: ["src/App.tsx"],
      agent: "frontend",
      validations: ["website behavior test"],
    };

    expect(() =>
      validateCoderTaskOutput({
        files: {
          "src/App.tsx": `// requirement: ${requirementId}
export function App() {
  return <main>Coming soon</main>;
}`,
        },
        task,
        contract,
      }),
    ).toThrow(/placeholder/i);
  });
});
