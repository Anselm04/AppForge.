export const BUILD_CREDIT_COST = 5;
export const SENIOR_DEV_CREDIT_COST = 6;
export const AI_GENERATE_CREDIT_COST = 5;

export function creditsExhaustedBody(balance: number, cost: number, action = "continue") {
  return {
    error: "credits_exhausted",
    code: "credits_exhausted" as const,
    balance,
    cost,
    message: `Out of credits. Subscribe or buy extra credits to ${action}. Builds stay paused until you pay.`,
    payUrl: "/pricing",
  };
}
