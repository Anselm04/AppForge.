import { randomBytes } from "node:crypto";

export type SupportSeverity = "SEV-1" | "SEV-2" | "SEV-3" | "SEV-4";
export type SupportStatus =
  "open" | "investigating" | "waiting-customer" | "resolved" | "closed";

export type SupportCase = {
  caseRef: string;
  userId: number;
  projectId: number | null;
  buildRef: string | null;
  severity: SupportSeverity;
  category: string;
  status: SupportStatus;
  customerSummary: string;
  internalNotes: string[];
  logRefs: string[];
  billingAdjustment: { credits: number; reason: string } | null;
  resolution: string | null;
  rootCause: string | null;
  prevention: string | null;
  createdAt: string;
  updatedAt: string;
};

export function createSupportCase(input: {
  userId: number;
  projectId?: number | null;
  buildRef?: string | null;
  severity: SupportSeverity;
  category: string;
  customerSummary: string;
}): SupportCase {
  const now = new Date().toISOString();
  return {
    caseRef: `CASE-${randomBytes(6).toString("hex").toUpperCase()}`,
    userId: input.userId,
    projectId: input.projectId ?? null,
    buildRef: input.buildRef ?? null,
    severity: input.severity,
    category: input.category.trim().slice(0, 80),
    status: "open",
    customerSummary: input.customerSummary.trim().slice(0, 4000),
    internalNotes: [],
    logRefs: [],
    billingAdjustment: null,
    resolution: null,
    rootCause: null,
    prevention: null,
    createdAt: now,
    updatedAt: now,
  };
}

export type BuildFailureKind =
  | "early_failure"
  | "provider_outage"
  | "internal_defect"
  | "invalid_customer_credentials"
  | "external_rejection"
  | "timeout"
  | "interruption"
  | "duplicate"
  | "cancelled";

export type CreditOutcome =
  "not_charged" | "released" | "refunded" | "charged" | "manual_review";

const FAILURE_COPY: Record<BuildFailureKind, string> = {
  early_failure: "The build stopped before useful generation work completed.",
  provider_outage:
    "A required external provider was unavailable during this build.",
  internal_defect: "AppForge encountered an internal build defect.",
  invalid_customer_credentials:
    "A connected service rejected the customer-provided credentials or permissions.",
  external_rejection: "An external platform rejected the requested operation.",
  timeout: "The build exceeded its safe execution window and was stopped.",
  interruption:
    "The build was interrupted before it could be safely completed.",
  duplicate: "A duplicate build was detected and stopped.",
  cancelled: "The build was cancelled before completion.",
};

const CREDIT_COPY: Record<CreditOutcome, string> = {
  not_charged: "No build credits were charged.",
  released: "Reserved build credits were released back to your balance.",
  refunded: "Charged build credits were restored to your balance.",
  charged:
    "The completed work remains charged under the build settlement rules.",
  manual_review:
    "Credit settlement requires support review; no duplicate adjustment will be applied.",
};

export function buildFailureExplanation(input: {
  kind: BuildFailureKind;
  creditOutcome: CreditOutcome;
  retryable: boolean;
}) {
  return {
    customerMessage: FAILURE_COPY[input.kind],
    creditMessage: CREDIT_COPY[input.creditOutcome],
    canRetry: input.retryable,
  };
}
