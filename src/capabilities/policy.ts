import type {
  CapabilityExecutionContext,
  CapabilityPolicyDecision,
  CapabilityTarget,
} from "./types.js";

const CONTROL_PLANE_PATTERN =
  /(?:appforge[-_ ]?(?:source|auth|mfa|stripe|billing|security|audit|watchdog|policy|admin)|appforge-source|\.env|ci[-_ ]?secret|service[-_ ]?role|root[-_ ]?(?:credential|secret|key)|master[-_ ]?(?:credential|secret|key)|trillionengine|viral[-_ ]?mind|marketing[-_ ]?app|credential[-_ ]?(?:read|export|dump)|secret[-_ ]?(?:read|export|dump))/i;
const PRIVILEGED_SCOPE_PATTERN =
  /(?:^|[:/_-])(?:appforge|platform|root|master)(?:[:/_-].*)?(?:admin|security|billing|auth|mfa|secrets?)(?:$|[:/_-])/i;
const ESCALATION_PATTERN =
  /(?:escalat|broaden|grant[-_ ]?(?:self|admin|permission)|permission[-_ ]?broad|enumerat[-_ ]?(?:account|repo)|list[-_ ]?(?:all|account|repo)|disable[-_ ]?(?:audit|watchdog|policy|security))/i;

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
    return deny(
      "Trusted build correlation context is required",
      context,
      "high",
    );
  }

  const capabilityAndPurpose = `${context.requestedCapability} ${context.purpose}`;
  if (CONTROL_PLANE_PATTERN.test(capabilityAndPurpose)) {
    return deny(
      "Requested capability touches a protected AppForge control-plane boundary",
      context,
    );
  }
  if (
    context.requestedScopes.some((scope) => CONTROL_PLANE_PATTERN.test(scope))
  ) {
    return deny(
      "Requested scope touches a protected AppForge control-plane boundary",
      context,
    );
  }
  if (
    context.requestedScopes.some((scope) =>
      PRIVILEGED_SCOPE_PATTERN.test(scope),
    )
  ) {
    return deny("Requested scope is platform-privileged", context);
  }

  const inspection = [capabilityAndPurpose, ...context.requestedScopes].join(
    " ",
  );
  if (ESCALATION_PATTERN.test(inspection)) {
    return deny(
      "Permission broadening or unrelated enumeration is forbidden",
      context,
      "high",
    );
  }

  return {
    allowed: true,
    riskLevel: "medium",
    reason: "Scoped capability request is within the active customer project",
    grantedScopes: [...context.requestedScopes],
    deniedScopes: [],
  };
}
