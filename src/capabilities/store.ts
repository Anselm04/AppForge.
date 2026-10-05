import { desc, eq } from "drizzle-orm";
import { ENV } from "../_core/env.js";
import { db } from "../db.js";
import * as schema from "../db/schema.js";
import { sanitizeCapabilityMetadata } from "./redaction.js";
import type {
  CapabilityExecutionContext,
  CapabilityPolicyDecision,
  CapabilityProviderState,
} from "./types.js";

const providerStateKey = (provider: string) =>
  `capability_provider:${provider}`;

export interface ProviderStateRecord {
  provider: string;
  state: CapabilityProviderState;
  reason: string;
  failureCount: number;
  anomalyCount: number;
  updatedAt: string;
}

const defaultState = (provider: string): ProviderStateRecord => ({
  provider,
  state: "healthy",
  reason: "No containment action recorded",
  failureCount: 0,
  anomalyCount: 0,
  updatedAt: new Date(0).toISOString(),
});

export async function getCapabilityProviderState(
  provider: string,
): Promise<ProviderStateRecord> {
  const row = await db.query.appSettings.findFirst({
    where: eq(schema.appSettings.key, providerStateKey(provider)),
  });
  if (!row?.value) return defaultState(provider);
  try {
    const parsed = JSON.parse(row.value) as ProviderStateRecord;
    return {
      ...defaultState(provider),
      ...parsed,
      provider,
    };
  } catch {
    return defaultState(provider);
  }
}

export async function setCapabilityProviderState(
  provider: string,
  state: CapabilityProviderState,
  reason: string,
  counters?: { failureCount?: number; anomalyCount?: number },
): Promise<ProviderStateRecord> {
  const existing = await getCapabilityProviderState(provider);
  const next: ProviderStateRecord = {
    provider,
    state,
    reason: reason.slice(0, 1_000),
    failureCount: counters?.failureCount ?? existing.failureCount,
    anomalyCount: counters?.anomalyCount ?? existing.anomalyCount,
    updatedAt: new Date().toISOString(),
  };
  await db
    .insert(schema.appSettings)
    .values({
      key: providerStateKey(provider),
      value: JSON.stringify(next),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.appSettings.key,
      set: { value: JSON.stringify(next), updatedAt: new Date() },
    });
  return next;
}

export async function recordCapabilityAudit(input: {
  context: CapabilityExecutionContext;
  provider: string;
  policy: CapabilityPolicyDecision;
  providerState: CapabilityProviderState;
  resultStatus: string;
  latencyMs: number;
  toolId?: string;
  metadata?: unknown;
  containmentAction?: string | null;
}): Promise<void> {
  await db.insert(schema.complianceRecords).values({
    recordType: "capability_audit",
    userId: input.context.customerId,
    adminEmail: ENV.ownerEmail || "owner@appforge.internal",
    details: sanitizeCapabilityMetadata({
      timestamp: new Date().toISOString(),
      correlationId: input.context.correlationId,
      buildJobId: input.context.buildJobId,
      projectId: input.context.projectId,
      customerId: input.context.customerId,
      requestingAgent: input.context.requestingAgent,
      taskId: input.context.taskId ?? null,
      provider: input.provider,
      capability: input.context.requestedCapability,
      toolId: input.toolId ?? null,
      purpose: input.context.purpose,
      policyDecision: input.policy.allowed ? "allowed" : "denied",
      riskLevel: input.policy.riskLevel,
      grantedScopes: input.policy.grantedScopes,
      deniedScopes: input.policy.deniedScopes,
      providerState: input.providerState,
      resultStatus: input.resultStatus,
      latencyMs: Math.max(0, Math.round(input.latencyMs)),
      containmentAction: input.containmentAction ?? null,
      metadata: input.metadata ?? null,
    }),
  });
}

export async function createCapabilitySecurityIncident(input: {
  context: CapabilityExecutionContext;
  provider: string;
  severity: "warning" | "critical";
  reason: string;
  attemptedCapability?: string;
  containmentAction: string;
  providerState: CapabilityProviderState;
  evidence?: unknown;
}): Promise<void> {
  await db.insert(schema.complianceRecords).values({
    recordType: "capability_security_incident",
    userId: input.context.customerId,
    adminEmail: ENV.ownerEmail || "owner@appforge.internal",
    details: sanitizeCapabilityMetadata({
      correlationId: input.context.correlationId,
      projectId: input.context.projectId,
      buildJobId: input.context.buildJobId,
      provider: input.provider,
      severity: input.severity,
      reason: input.reason,
      attemptedCapability:
        input.attemptedCapability ?? input.context.requestedCapability,
      containmentAction: input.containmentAction,
      providerState: input.providerState,
      acknowledgedAt: null,
      resolvedAt: null,
      evidence: input.evidence ?? null,
    }),
  });
}

export async function listCapabilitySecurityIncidents(limit = 50) {
  return db.query.complianceRecords.findMany({
    where: eq(
      schema.complianceRecords.recordType,
      "capability_security_incident",
    ),
    orderBy: [desc(schema.complianceRecords.createdAt)],
    limit: Math.max(1, Math.min(limit, 200)),
  });
}
