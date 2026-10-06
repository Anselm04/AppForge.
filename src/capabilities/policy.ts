import type {
  CapabilityExecutionContext,
  CapabilityPolicyDecision,
  CapabilityRisk,
} from "./types.js";

const DENIED_TEXT = [
  /(?:^|[/\\])\.env(?:\.|$)/i,
  /appforge(?:\.|\/|$)/i,
  /trillionengine/i,
  /trillionos/i,
  /trillionai.*(?:website|marketing|engine|security)/i,
  /(?:root|master|service[-_ ]?role|private[-_ ]?key|secret|credential)/i,
];

const DENIED_CAPABILITIES = [
  /appforge\.(?:admin|auth|mfa|stripe|billing|security|policy|audit|watchdog)/i,
  /permissions?\.(?:escalate|broaden|grant)/i,
  /(?:account|repository|repo)s?\.enumerate/i,
];

function deny(reason: string, risk: CapabilityRisk, scopes: string[]): CapabilityPolicyDecision {
  return {
    allowed: false,
    risk,
    reason,
    grantedScopes: [],
    deniedScopes: [...scopes],
  };
}

export function evaluateCapabilityPolicy(
  context: CapabilityExecutionContext,
): CapabilityPolicyDecision {
  const scopes = [...new Set(context.requestedScopes.map((scope) => scope.trim()).filter(Boolean))];

  if (!context.customerId || !context.projectId || !context.buildJobId || !context.correlationId) {
    return deny("Trusted build context is incomplete", "critical", scopes);
  }

  if (context.targetCustomerId && context.targetCustomerId !== context.customerId) {
    return deny("Cross-customer capability access is forbidden", "critical", scopes);
  }
  if (context.targetProjectId && context.targetProjectId !== context.projectId) {
    return deny("Cross-project capability access is forbidden", "critical", scopes);
  }

  const capability = context.requestedCapability.trim();
  if (!capability) return deny("Capability identifier is required", "high", scopes);
  if (DENIED_CAPABILITIES.some((pattern) => pattern.test(capability))) {
    return deny("Requested capability targets AppForge control-plane or privilege escalation", "critical", scopes);
  }

  const target = context.target?.trim() ?? "";
  if (target && DENIED_TEXT.some((pattern) => pattern.test(target))) {
    return deny("Requested target crosses a protected product, source, or secret boundary", "critical", scopes);
  }

  if (scopes.some((scope) => /(?:admin|root|owner|service[-_ ]?role|secrets?|mfa|billing)/i.test(scope))) {
    return deny("Requested scopes exceed customer-project least privilege", "high", scopes);
  }

  return {
    allowed: true,
    risk: scopes.some((scope) => /write|delete|manage/i.test(scope)) ? "medium" : "low",
    reason: "Request is scoped to the active customer project",
    grantedScopes: scopes,
    deniedScopes: [],
  };
}
