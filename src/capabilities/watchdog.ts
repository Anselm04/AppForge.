import {
  createCapabilitySecurityIncident,
  getCapabilityProviderState,
  setCapabilityProviderState,
  type ProviderStateRecord,
} from "./store.js";
import type { CapabilityWatchdogSignal } from "./broker.js";
import type { CapabilityProviderState } from "./types.js";

const CRITICAL_COMPROMISE = /(?:confirmed|verified).*(?:credential|secret|exfiltrat|integrity|compromise)|(?:credential|secret).*(?:exfiltrat|compromise)/i;
const SECURITY_BOUNDARY = /(?:cross-project|cross-customer|protected appforge|credential|secret|policy bypass|watchdog|audit|billing|mfa|auth)/i;

export function evaluateWatchdogTransition(
  current: ProviderStateRecord,
  signal: Pick<CapabilityWatchdogSignal, "outcome" | "reason">,
): ProviderStateRecord {
  const reason = signal.reason?.slice(0, 1_000) || signal.outcome;
  let state: CapabilityProviderState = current.state;
  let failureCount = current.failureCount;
  let anomalyCount = current.anomalyCount;

  if (signal.outcome === "success") {
    failureCount = 0;
  } else if (signal.outcome === "provider_failure") {
    failureCount += 1;
    if (failureCount >= 3 && state === "healthy") state = "restricted";
  } else if (signal.outcome === "security_violation") {
    anomalyCount += 1;
    state = CRITICAL_COMPROMISE.test(reason) ? "disabled" : "quarantined";
  } else if (signal.outcome === "policy_denial" && SECURITY_BOUNDARY.test(reason)) {
    anomalyCount += 1;
    state = "quarantined";
  }

  return {
    provider: current.provider,
    state,
    reason,
    failureCount,
    anomalyCount,
    updatedAt: new Date().toISOString(),
  };
}

export async function processCapabilityWatchdogSignal(
  signal: CapabilityWatchdogSignal,
): Promise<void> {
  const current = await getCapabilityProviderState(signal.provider);
  const next = evaluateWatchdogTransition(current, signal);
  const changed =
    next.state !== current.state ||
    next.failureCount !== current.failureCount ||
    next.anomalyCount !== current.anomalyCount;

  if (!changed) return;

  await setCapabilityProviderState(signal.provider, next.state, next.reason, {
    failureCount: next.failureCount,
    anomalyCount: next.anomalyCount,
  });

  if (
    next.state === "restricted" ||
    next.state === "quarantined" ||
    next.state === "disabled"
  ) {
    await createCapabilitySecurityIncident({
      context: signal.context,
      provider: signal.provider,
      severity: next.state === "disabled" ? "critical" : "warning",
      reason: next.reason,
      containmentAction: next.state,
      providerState: next.state,
      evidence: signal.evidence,
    });
  }
}
