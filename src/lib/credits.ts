export const BUILD_CREDIT_COST = 5;
export const SENIOR_DEV_CREDIT_COST = 6;
export const AI_GENERATE_CREDIT_COST = 5;

/** Shown in SSE/logs for transparency — not charged separately (build uses BUILD_CREDIT_COST upfront). */
export const PIPELINE_PHASE_LABELS = {
  Planner: "Planning",
  Coder: "Coding",
  Validator: "Validating",
  Reviewer: "Reviewing",
  Testing: "Generating tests",
} as const;

export function creditsExhaustedBody(
  balance: number,
  cost: number,
  action = "continue",
) {
  return {
    error: "credits_exhausted",
    code: "credits_exhausted" as const,
    balance,
    cost,
    message: `Out of credits. Subscribe or buy extra credits to ${action}. Builds stay paused until you pay.`,
    payUrl: "/pricing",
  };
}
