import { describe, expect, it } from "vitest";
import { evaluateCapabilityPolicy } from "../capabilities/policy.js";
import { sanitizeCapabilityMetadata } from "../capabilities/redaction.js";
import type { CapabilityExecutionContext } from "../capabilities/types.js";

const baseContext: CapabilityExecutionContext = {
  customerId: 7,
  projectId: 42,
  buildJobId: "build-42-1",
  requestingAgent: "IntegrationAgent",
  taskId: "task-1",
  purpose: "Connect the generated customer project to GitHub issues",
  requestedCapability: "GITHUB_CREATE_ISSUE",
  requestedScopes: ["issues:write"],
  correlationId: "corr-1",
};

describe("capability policy", () => {
  it.each([
    [
      "AppForge billing",
      "APPFORGE_STRIPE_UPDATE_ACCOUNT",
      ["appforge:billing:admin"],
    ],
    ["AppForge MFA", "APPFORGE_AUTH_DISABLE_MFA", ["appforge:auth:admin"]],
    [
      "platform security",
      "DISABLE_APPFORGE_AUDIT_LOGGING",
      ["appforge:security:admin"],
    ],
    ["service credential", "READ_SERVICE_ROLE_KEY", ["secrets:read"]],
    ["platform source", "READ_FILE", ["appforge-source:.env"]],
    ["other product", "TRILLIONENGINE_ADMIN", ["trillionengine:admin"]],
  ])("denies protected %s requests", (_label, capability, scopes) => {
    const result = evaluateCapabilityPolicy({
      context: {
        ...baseContext,
        requestedCapability: capability,
        requestedScopes: scopes,
      },
      target: { customerId: 7, projectId: 42 },
    });
    expect(result.allowed).toBe(false);
    expect(["high", "critical"]).toContain(result.riskLevel);
  });

  it("denies cross-customer and cross-project targets", () => {
    expect(
      evaluateCapabilityPolicy({
        context: baseContext,
        target: { customerId: 8, projectId: 42 },
      }).allowed,
    ).toBe(false);
    expect(
      evaluateCapabilityPolicy({
        context: baseContext,
        target: { customerId: 7, projectId: 99 },
      }).allowed,
    ).toBe(false);
  });

  it("allows narrowly scoped customer-project Stripe and auth integrations", () => {
    const stripe = evaluateCapabilityPolicy({
      context: {
        ...baseContext,
        purpose: "Create Stripe checkout for the generated customer project",
        requestedCapability: "STRIPE_CREATE_CHECKOUT_SESSION",
        requestedScopes: ["checkout:write"],
      },
      target: { customerId: 7, projectId: 42 },
    });
    const auth = evaluateCapabilityPolicy({
      context: {
        ...baseContext,
        purpose: "Configure authentication for the generated customer project",
        requestedCapability: "SUPABASE_CREATE_AUTH_USER",
        requestedScopes: ["project-auth:write"],
      },
      target: { customerId: 7, projectId: 42 },
    });
    expect(stripe.allowed).toBe(true);
    expect(auth.allowed).toBe(true);
  });

  it("allows a narrowly scoped active-project integration request", () => {
    const result = evaluateCapabilityPolicy({
      context: baseContext,
      target: { customerId: 7, projectId: 42 },
    });
    expect(result.allowed).toBe(true);
    expect(result.riskLevel).toBe("medium");
  });

  it("redacts credential-like metadata before persistence", () => {
    const result = sanitizeCapabilityMetadata({
      ok: true,
      token: "secret-token",
      nested: { api_key: "secret-api-key", value: "safe" },
    }) as Record<string, unknown>;
    expect(result.token).toBe("[REDACTED]");
    expect(result.nested).toEqual({
      api_key: "[REDACTED]",
      value: "safe",
    });
  });
});
