import { describe, expect, it } from "vitest";
import {
  buildProductContract,
  classifyProductIntent,
  classifyProductType,
  detectSecondaryCapabilities,
  renderCanonicalPromptContext,
  renderProductContractForAgents,
  selectProductStack,
  validateProductContract,
  withSelectedTechnologyStack,
  type ProductType,
} from "../productContract.js";

describe("prompt understanding", () => {
  const cases: Array<[string, ProductType]> = [
    ["Create a public marketing website for a carving studio", "website"],
    [
      "Build a multi-tenant SaaS CRM with subscription accounts",
      "saas_application",
    ],
    ["Create an iOS and Android mobile app for field workers", "mobile_app"],
    [
      "Build a desktop app with Electron for inventory management",
      "desktop_app",
    ],
    ["Create a multiplayer browser game with levels and scoring", "game"],
    ["Build an AI agent that researches documents and uses tools", "ai_agent"],
    [
      "Build a CLI developer tool that generates typed SDK clients",
      "developer_tool",
    ],
    ["Create a REST API for invoices with OpenAPI documentation", "api"],
    [
      "Build an e-commerce storefront with cart and checkout",
      "ecommerce_product",
    ],
    [
      "Build a Chrome browser extension that saves selected text",
      "browser_extension",
    ],
    [
      "Create a workflow automation tool that syncs CRM records nightly",
      "automation_tool",
    ],
    [
      "Build a data product with analytics dashboards and KPI reporting",
      "data_product",
    ],
  ];

  it.each(cases)("classifies %s", (prompt, expected) => {
    const intent = classifyProductIntent(prompt);
    expect(intent.ambiguous).toBe(false);
    expect(intent.primaryProductType).toBe(expected);
    expect(intent.confidence).toBeGreaterThanOrEqual(0.7);
    expect(classifyProductType(prompt)).toBe(expected);
  });

  it("detects all required secondary capabilities", () => {
    const prompt =
      "Build a SaaS application with login, PostgreSQL database, Stripe billing, AI assistant, analytics, admin console, teams, push notifications, search, file uploads, Slack integration, and production deployment.";
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

  it("preserves the original prompt byte-for-byte in intent and contract", () => {
    const prompt =
      "  Build a mobile app <with> uploads, login, and notifications.\nKeep this spacing exactly.  ";
    const intent = classifyProductIntent(prompt);
    const contract = buildProductContract(prompt);
    expect(intent.originalPrompt).toBe(prompt);
    expect(contract.originalPrompt).toBe(prompt);
  });

  it("asks for clarification instead of guessing when product intent is ambiguous", () => {
    const intent = classifyProductIntent(
      "Build something useful for my business",
    );
    expect(intent.ambiguous).toBe(true);
    expect(intent.primaryProductType).toBeNull();
    expect(intent.confidence).toBeLessThan(0.5);
    expect(intent.clarificationQuestions[0]).toContain("What kind of product");
  });

  it("flags close competing product types and exposes alternatives", () => {
    const intent = classifyProductIntent(
      "Build a browser extension and a developer tool for VSCode",
    );
    expect(intent.ambiguous).toBe(true);
    expect(intent.alternatives.length).toBeGreaterThan(0);
    expect(intent.clarificationQuestions[0]).toMatch(/primarily/i);
  });

  it("creates one canonical interpretation for downstream agents", () => {
    const prompt =
      "Build an AI agent with authentication, database storage, Slack integration, and deployment";
    const intent = classifyProductIntent(prompt);
    const context = renderCanonicalPromptContext(prompt, intent);
    expect(context.startsWith(prompt)).toBe(true);
    expect(context).toContain("DO NOT REINTERPRET");
    expect(context).toContain("Primary product type id: ai_agent");
    expect(context).toContain(
      "Secondary capability ids: authentication, database, ai, external_integrations, deployment",
    );
  });

  it("selects a runtime from the resolved product intent", () => {
    expect(selectProductStack("Build a browser game with levels")).toBe(
      "phaser-html5",
    );
    expect(selectProductStack("Build a REST API for invoices")).toBe(
      "api-service",
    );
    expect(
      selectProductStack("Build a Chrome browser extension for saving links"),
    ).toBe("chrome-extension");
    expect(selectProductStack("Build a Flutter mobile app for bookings")).toBe(
      "flutter-firebase",
    );
    expect(selectProductStack("Build a Tauri desktop app for notes")).toBe(
      "tauri-rust",
    );
  });

  it("creates requirements and monetization evidence from the resolved intent", () => {
    const contract = buildProductContract(
      "Build a paid AI agent with subscriptions and progress tracking",
    );
    expect(contract.productType).toBe("ai_agent");
    expect(contract.productFamilies).toContain("ai");
    expect(contract.productFamilies).toContain("billing");
    expect(contract.monetizationRequirements.length).toBeGreaterThan(0);
    expect(
      contract.functionalRequirements.every((requirement) =>
        /^REQ-\d{3}$/.test(requirement.id),
      ),
    ).toBe(true);
    expect(contract.targetUsers.length).toBeGreaterThan(0);
    expect(contract.userRoles.length).toBeGreaterThan(0);
    expect(contract.coreWorkflows.length).toBeGreaterThan(0);
    expect(contract.nonFunctionalRequirements.length).toBeGreaterThan(0);
    expect(contract.securityRequirements.length).toBeGreaterThan(0);
    expect(contract.deploymentRequirements.length).toBeGreaterThan(0);
    expect(contract.researchRequirements.length).toBeGreaterThan(0);
    expect(contract.runtimeRequirements.length).toBeGreaterThan(0);
    expect(validateProductContract(contract)).toEqual(contract);
  });

  it("rejects incomplete contracts at runtime", () => {
    expect(() =>
      validateProductContract({
        version: 2,
        originalPrompt: "Build a website",
        productType: "website",
      }),
    ).toThrow();
  });

  it("preserves an explicit selected stack inside the same contract", () => {
    const base = buildProductContract("Build a website for my studio");
    const updated = withSelectedTechnologyStack(base, "next-node");
    expect(updated.originalPrompt).toBe(base.originalPrompt);
    expect(updated.productType).toBe(base.productType);
    expect(updated.selectedTechnologyStack).toBe("next-node");
  });

  it("renders one authoritative contract for downstream stages", () => {
    const contract = buildProductContract(
      "Build an AI agent with login, database storage, Slack integration, and deployment",
    );
    const rendered = renderProductContractForAgents(contract);
    expect(rendered).toContain("AUTHORITATIVE");
    expect(rendered).toContain(contract.originalPrompt);
    expect(rendered).toContain('"productType": "ai_agent"');
  });
});
