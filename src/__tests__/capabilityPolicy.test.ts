import { describe, expect, it } from "vitest";
import { evaluateCapabilityPolicy } from "../capabilities/policy.js";
import { redactCapabilityMetadata } from "../capabilities/redaction.js";
import type { CapabilityExecutionContext } from "../capabilities/types.js";

const baseContext: CapabilityExecutionContext = {
  customerId: "customer-1",
  projectId: "project-1",
  buildJobId: "build-1",
  requestingAgent: "integration-agent",
  taskId: "task-1",
  purpose: "connect the customer's CRM to their generated app",
  requestedCapability: "crm.contacts.read",
  requestedScopes: ["contacts:read"],
  correlationId: "corr-1",
};

function decision(overrides: Partial<CapabilityExecutionContext> = {}) {
  return evaluateCapabilityPolicy({ ...baseContext, ...overrides });
}

describe("capability policy", () => {
  it.each([
    ["AppForge source", { target: "repo:Anselm04/AppForge." }],
    ["environment secrets", { target: ".env.production" }],
    ["MFA", { requestedCapability: "appforge.admin.mfa.disable" }],
    ["billing admin", { requestedCapability: "appforge.stripe.admin" }],
    ["security policy", { requestedCapability: "appforge.security.policy.write" }],
    ["other TrillionAI product", { target: "repo:Anselm04/TrillionEngine" }],
    ["permission escalation", { requestedCapability: "permissions.escalate" }],
    ["account enumeration", { requestedCapability: "github.accounts.enumerate" }],
  ])("denies %s access", (_label, overrides) => {
    expect(decision(overrides as Partial<CapabilityExecutionContext>).allowed).toBe(false);
  });

  it("denies cross-customer and cross-project targets", () => {
    expect(decision({ targetCustomerId: "customer-2" }).allowed).toBe(false);
    expect(decision({ targetProjectId: "project-2" }).allowed).toBe(false);
  });

  it("allows a narrowly scoped customer-project integration request", () => {
    expect(
      decision({
        targetCustomerId: "customer-1",
        targetProjectId: "project-1",
        target: "customer-project:project-1:crm",
      }),
    ).toMatchObject({ allowed: true, risk: "low" });
  });
});

describe("capability audit redaction", () => {
  it("recursively removes credential-like values", () => {
    const value = redactCapabilityMetadata({
      authorization: "Bearer secret",
      nested: { apiKey: "secret", safe: "ok" },
      arr: [{ refresh_token: "secret" }],
    }) as Record<string, unknown>;

    expect(value.authorization).toBe("[REDACTED]");
    expect(value.nested).toEqual({ apiKey: "[REDACTED]", safe: "ok" });
    expect(value.arr).toEqual([{ refresh_token: "[REDACTED]" }]);
  });

  it("bounds large metadata", () => {
    const value = redactCapabilityMetadata({ huge: "x".repeat(50_000) }) as Record<string, unknown>;
    expect(String(value.huge).length).toBeLessThan(21_000);
  });
});
