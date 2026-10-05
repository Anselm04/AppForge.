import type {
  CapabilityExecutionContext,
  CapabilityPolicyDecision,
  CapabilityTarget,
} from "./types.js";

const PROTECTED_PATTERN = /(?:appforge[-_ ]?source|\.env|ci[-_ ]?secret|service[-_ ]?role|root|master|auth|mfa|stripe|billing|security|audit|watchdog|policy|trillionengine|viral[-_ ]?mind|marketing[-_ ]?app|admin|credential|secret)/i;
const ESCALATION_PATTERN = /(?:escalat|broaden|grant|permission|enumerat|list[-_ ]?(?:all|account|repo)|disable)/i;

function deny(
  reason: string,
  context: CapabilityExecutionContext,
  riskLevel: "high" | "critical" = "critical",
): CapabilityPolicyDecision {
  return {
    allowed: false,
    riskLevel,
    reason,
    grantedScopes: [],
    deniedScopes: [...context.requestedScopes],
  };
}

export function evaluateCapabilityPolicy(input: {
  context: CapabilityExecutionContext;
  target: CapabilityTarget;
}): CapabilityPolicyDecision {
  const { context, target } = input;

  if (target.customerId !== context.customerId) {
    return deny("Cross-customer capability access is forbidden", context);
  }
  if (target.projectId !== context.projectId) {
    return deny("Cross-project capability access is forbidden", context);
  }
  if (!context.correlationId.trim() || !context.buildJobId.trim()) {
    return deny("Trusted build correlation context is required", context, "high");
  }

  const inspection = [
    context.requestedCapability,
    context.purpose,
    ...context.requestedScopes,
  ].join(" ");

  if (PROTECTED_PATTERN.test(inspection)) {
    return deny("Requested capability touches a protected AppForge boundary", context);
  }
  if (ESCALATION_PATTERN.test(inspection)) {
    return deny("Permission broadening or unrelated enumeration is forbidden", context, "high");
  }

  return {
    allowed: true,
    riskLevel: "medium",
    reason: "Scoped capability request is within the active customer project",
    grantedScopes: [...context.requestedScopes],
    deniedScopes: [],
  };
}
