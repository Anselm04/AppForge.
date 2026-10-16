import type { BuildFailureKind, CreditOutcome } from "./customerOperations.js";

export type CreditSettlementDecision = {
  outcome: CreditOutcome;
  amount: number;
  customerFault: boolean;
  reason: string;
  idempotencyKey: string;
};

export function decideCreditSettlement(input: {
  kind: BuildFailureKind;
  usefulWorkDelivered: boolean;
  creditsReserved: number;
  creditsCharged: number;
  customerCaused: boolean;
  buildRef?: string;
}): CreditSettlementDecision {
  const reserved = Math.max(0, Math.trunc(input.creditsReserved));
  const charged = Math.max(0, Math.trunc(input.creditsCharged));
  const appforgeOrProviderFailure = new Set<BuildFailureKind>([
    "early_failure",
    "provider_outage",
    "internal_defect",
    "timeout",
    "interruption",
    "duplicate",
  ]).has(input.kind);

  let outcome: CreditOutcome;
  let amount = 0;
  let reason: string;

  if (appforgeOrProviderFailure && !input.usefulWorkDelivered) {
    if (charged > 0) {
      outcome = "refunded";
      amount = charged;
      reason = "AppForge/provider failure before useful work was delivered.";
    } else if (reserved > 0) {
      outcome = "released";
      amount = reserved;
      reason = "Reserved credits released because useful work was not delivered.";
    } else {
      outcome = "not_charged";
      reason = "Failure occurred before credits were consumed.";
    }
  } else if (input.customerCaused && input.usefulWorkDelivered) {
    outcome = "charged";
    amount = charged;
    reason = "Material work was delivered before a customer-controlled dependency failed.";
  } else if (input.kind === "cancelled" && input.usefulWorkDelivered) {
    outcome = "charged";
    amount = charged;
    reason = "Customer cancellation occurred after material work was delivered.";
  } else if (charged > 0 && !input.usefulWorkDelivered) {
    outcome = "refunded";
    amount = charged;
    reason = "No useful work was delivered.";
  } else {
    outcome = "manual_review";
    reason = "Settlement requires evidence review to avoid an unfair or duplicate adjustment.";
  }

  const buildRef = input.buildRef?.trim() || "unassigned-build";
  return {
    outcome,
    amount,
    customerFault: input.customerCaused,
    reason,
    idempotencyKey: `credit-settlement:${buildRef}:${input.kind}:${outcome}`,
  };
}
