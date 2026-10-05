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
    ["AppForge billing", "STRIPE_UPDATE_ACCOUNT", ["billing:admin"]],
    ["AppForge MFA", "AUTH_DISABLE_MFA", ["auth:admin"]],
    ["platform security", "DISABLE_AUDIT_LOGGING", ["security:admin"]],
    ["service credential", "READ_SERVICE_ROLE_KEY", ["secrets:read"]],
    ["platform source", "READ_FILE", ["appforge-source:.env"]],
    ["other product", "TRILLIONENGINE_ADMIN", ["trillionengine:admin"]],
  ])("denies protected %s requests", (_label, capability, scopes) => {
    const result = evaluateCapabilityPolicy({
      context: { ...baseContext, requestedCapability: capability, requestedScopes: scopes },
      target: { customerId: 7, projectId: 42 },
    });
    expect(result.allowed).toBe(false);
    expect(["high", "critical"]).toContain(result.riskLevel);
  });

  it("denies cross-customer and cross-project targets", () => {
    expect(
      evaluateCapabilityPolicy({ context: baseContext, target: { customerId: 8, projectId: 42 } }).allowed,
    ).toBe(false);
    expect(
      evaluateCapabilityPolicy({ context: baseContext, target: { customerId: 7, projectId: 99 } }).allowed,
    ).toBe(false);
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
    expect(result.nested).toEqual({ api_key: "[REDACTED]", value: "safe" });
  });
});
