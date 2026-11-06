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
    message: `Out of credits. To ${action} before your next monthly refill, you must buy extra credits as a separate optional payment. Otherwise credit-consuming work stays paused until credits become available. No automatic top-up charges.`,
    payUrl: "/pricing",
  };
}
