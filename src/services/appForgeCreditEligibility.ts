type PaidSubscription =
  | {
      status?: string | null;
      tier?: string | null;
      currentPeriodEnd?: Date | null;
      trialEnd?: Date | null;
    }
  | null
  | undefined;

export function assertEligibleForCreditTopUp(
  subscription: PaidSubscription,
  now: Date = new Date(),
): void {
  const status = subscription?.status;
  const active = status === "active" || status === "trialing";
  const tier = subscription?.tier;
  const paidTier =
    tier === "starter" || tier === "builder" || tier === "studio";
  const periodValid =
    !subscription?.currentPeriodEnd || subscription.currentPeriodEnd > now;
  const trialValid =
    status !== "trialing" ||
    !subscription?.trialEnd ||
    subscription.trialEnd > now;
  if (!active || !paidTier || !periodValid || !trialValid) {
    throw new Error(
      "Credit top-ups require an active paid AppForge subscription. Explore accounts must subscribe before purchasing build credits.",
    );
  }
}
