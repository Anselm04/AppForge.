import { describe, expect, it } from "vitest";
import {
  integrationCoderInstruction,
  integrationCompatibilityProblems,
  integrationImplementationPolicy,
  integrationPlannerInstruction,
  validateIntegrationArtifact,
} from "../integrationImplementation.js";
import {
  buildProductContract,
  validateProductContract,
  type ProductContract,
} from "../productContract.js";

function contract(): ProductContract {
  return validateProductContract({
    version: 2,
    originalPrompt:
      "Build a SaaS app with Stripe subscriptions and signed Stripe webhooks",
    productType: "saas_application",
    productFamilies: [
      "frontend",
      "backend",
      "billing",
      "integrations",
      "deployment",
    ],
    targetUsers: ["Customers"],
    userRoles: ["user", "admin"],
    coreWorkflows: ["Subscribe with Stripe", "Receive Stripe webhook events"],
    functionalRequirements: [
      {
        id: "REQ-001",
        text: "Create Stripe subscriptions server-side.",
        category: "workflow",
        priority: "must",
      },
      {
        id: "REQ-002",
        text: "Verify and deduplicate Stripe webhook events.",
        category: "security",
        priority: "must",
      },
    ],
    nonFunctionalRequirements: [
      "Use bounded retries and timeouts for provider calls.",
      "Expose verified integration health.",
    ],
    dataModels: [],
    integrations: ["Stripe"],
    securityRequirements: ["Never expose Stripe secrets to clients."],
    deploymentRequirements: ["Integration health must be verified."],
    monetizationRequirements: ["Stripe subscription billing."],
    selectedTechnologyStack: "react-node",
    researchRequirements: ["Use current Stripe API documentation."],
    runtimeRequirements: ["Node server runtime."],
    secondaryCapabilities: ["billing", "external_integrations", "deployment"],
    intentConfidence: 0.99,
    canonicalInterpretation:
      "Build a React and Node SaaS with server-side Stripe integration.",
  });
}

function completeFiles(): Record<string, string> {
  return {
    "src/server/integrations/stripeClient.ts": [
      "// Stripe server integration",
      "const MAX_ATTEMPTS = 3;",
      "const secret = process.env.STRIPE_SECRET_KEY;",
      'export const configurationState = secret ? "configured" : "unconfigured";',
      "export async function callStripe(url: string) {",
      '  if (!secret) throw new Error("Stripe is not configured");',
      "  let lastError: unknown;",
      "  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {",
      "    const controller = new AbortController();",
      "    const timeout = setTimeout(() => controller.abort(), 5000);",
      "    try {",
      "      const response = await fetch(url, { signal: controller.signal });",
      "      if (response.status === 429 && attempt < MAX_ATTEMPTS) {",
      '        const retryAfter = Number(response.headers.get("Retry-After") || "1");',
      "        await new Promise((resolve) => setTimeout(resolve, Math.min(5000, retryAfter * 1000)));",
      "        continue;",
      "      }",
      '      if (!response.ok) throw new Error("Stripe request failed");',
      "      return response.json();",
      "    } catch (error) {",
      "      lastError = error;",
      "      if (attempt === MAX_ATTEMPTS) throw error;",
      "      const backoff = Math.min(5000, 250 * 2 ** attempt);",
      "      await new Promise((resolve) => setTimeout(resolve, backoff));",
      "    } finally {",
      "      clearTimeout(timeout);",
      "    }",
      "  }",
      "  throw lastError;",
      "}",
    ].join("\n"),
    "src/server/integrations/health.ts": [
      'import { callStripe, configurationState } from "./stripeClient";',
      "export async function verifyStripeIntegration() {",
      '  if (configurationState === "unconfigured") return { state: "unconfigured", verified: false };',
      "  try {",
      '    await callStripe("https://api.stripe.com/v1/balance");',
      '    return { state: "connected", verified: true };',
      "  } catch {",
      '    return { state: "needs_attention", verified: false };',
      "  }",
      "}",
    ].join("\n"),
    "src/server/webhooks/stripe.ts": [
      'import Stripe from "stripe";',
      'const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");',
      "const processedEventIds = new Set<string>();",
      "export function verifyWebhook(rawBody: string, signature: string) {",
      "  const event = stripe.webhooks.constructEvent(",
      "    rawBody,",
      "    signature,",
      '    process.env.STRIPE_WEBHOOK_SECRET || "",',
      "  );",
      "  if (processedEventIds.has(event.id)) return { duplicate: true, eventId: event.id };",
      "  processedEventIds.add(event.id);",
      "  return { duplicate: false, eventId: event.id, event };",
      "}",
    ].join("\n"),
    ".env.example": ["STRIPE_SECRET_KEY=", "STRIPE_WEBHOOK_SECRET="].join("\n"),
    "docs/INTEGRATIONS.md": [
      "# Integrations",
      "## Stripe",
      "Environment configuration requires STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET on the server.",
      "Verify the connection using the server health check before showing connected state.",
      "Provider requests use bounded retry and timeout behavior.",
      "Rate limit responses use Retry-After and bounded backoff.",
      "Configure the Stripe webhook endpoint and signing secret; signatures are verified before processing.",
      "Duplicate webhook event IDs are rejected by idempotency protection.",
      "Troubleshoot unconfigured, needs-attention, timeout, retry, and rate-limit states from server logs.",
    ].join("\n"),
  };
}

describe("Section 19 generated integration contract", () => {
  it("detects named integrations from the original product prompt", () => {
    const detected = buildProductContract(
      "Build a SaaS app that sends Twilio SMS and syncs orders with Shopify",
      { productType: "saas_application" },
    );
    expect(detected.integrations).toContain("Twilio");
    expect(detected.integrations).toContain("Shopify");
    expect(detected.secondaryCapabilities).toContain("external_integrations");
  });

  it("derives provider and webhook requirements from the canonical contract", () => {
    const policy = integrationImplementationPolicy(contract());
    expect(policy.required).toBe(true);
    expect(policy.requestedIntegrations).toEqual(["Stripe"]);
    expect(policy.webhookRequired).toBe(true);
    expect(policy.serverBoundaryRequired).toBe(true);
    expect(integrationCompatibilityProblems(contract())).toEqual([]);
  });

  it("gives planner and coder explicit connection, retry, webhook and secret boundaries", () => {
    const planner = integrationPlannerInstruction(contract());
    const coder = integrationCoderInstruction(contract());
    for (const text of [planner, coder]) {
      expect(text).toMatch(/server/i);
      expect(text).toMatch(/timeout/i);
      expect(text).toMatch(/retry/i);
      expect(text).toMatch(/429|rate/i);
      expect(text).toMatch(/webhook/i);
      expect(text).toMatch(/signature/i);
      expect(text).toMatch(/duplicate|idempot/i);
      expect(text).toMatch(/verified|verification/i);
      expect(text).toMatch(/secret/i);
    }
  });

  it("accepts a complete verified server-side Stripe integration", () => {
    expect(
      validateIntegrationArtifact({
        contract: contract(),
        files: completeFiles(),
      }),
    ).toEqual([]);
  });

  it("rejects missing health, docs, webhook and unsafe client secret references", () => {
    const files = completeFiles();
    delete files["src/server/integrations/health.ts"];
    delete files["src/server/webhooks/stripe.ts"];
    delete files["docs/INTEGRATIONS.md"];
    files["src/components/Leak.tsx"] =
      "export const secret = import.meta.env.STRIPE_SECRET_KEY;";

    const problems = validateIntegrationArtifact({
      contract: contract(),
      files,
    });

    expect(problems).toContain(
      "integration contract: missing integration health/status implementation",
    );
    expect(problems).toContain(
      "integration contract: missing integration setup documentation",
    );
    expect(problems).toContain(
      "integration contract: missing webhook/callback handler",
    );
    expect(problems).toContain(
      "integration contract: client-exposed file references provider secret material: src/components/Leak.tsx",
    );
  });

  it("rejects fake connection state and incomplete webhook safety", () => {
    const files = completeFiles();
    files["src/server/integrations/health.ts"] =
      'export const health = { state: process.env.STRIPE_SECRET_KEY ? "connected" : "unconfigured" };';
    files["src/server/webhooks/stripe.ts"] =
      "export function webhook(event: any) { return event; }";

    const problems = validateIntegrationArtifact({
      contract: contract(),
      files,
    });

    expect(problems).toContain(
      "integration contract: health claims connection from configuration without active verification",
    );
    expect(problems).toContain(
      "integration contract: webhook handler has no signature verification",
    );
    expect(problems).toContain(
      "integration contract: webhook handler has no duplicate-event protection",
    );
  });
});
