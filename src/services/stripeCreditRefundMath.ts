export type CreditRefundAdjustment = {
  targetCredits: number;
  delta: number;
};

export function calculateCreditRefundAdjustment({
  originalCredits,
  chargeAmount,
  amountRefunded,
  fullyRefunded,
  accountedCredits,
}: {
  originalCredits: number;
  chargeAmount: number;
  amountRefunded: number;
  fullyRefunded: boolean;
  accountedCredits: number;
}): CreditRefundAdjustment {
  if (!Number.isSafeInteger(originalCredits) || originalCredits <= 0) {
    throw new Error("Invalid original credit purchase amount");
  }
  if (
    !Number.isSafeInteger(chargeAmount) ||
    chargeAmount <= 0 ||
    !Number.isSafeInteger(amountRefunded) ||
    amountRefunded < 0 ||
    amountRefunded > chargeAmount
  ) {
    throw new Error("Invalid Stripe refund amounts");
  }
  if (
    !Number.isSafeInteger(accountedCredits) ||
    accountedCredits < 0 ||
    accountedCredits > originalCredits
  ) {
    throw new Error("Invalid accounted refund credits");
  }

  const weightedRefund = originalCredits * amountRefunded;
  if (!Number.isSafeInteger(weightedRefund)) {
    throw new Error("Stripe refund calculation exceeds safe integer range");
  }

  const calculatedTarget = fullyRefunded
    ? originalCredits
    : Math.floor(weightedRefund / chargeAmount);
  const targetCredits = Math.min(originalCredits, calculatedTarget);

  return {
    targetCredits,
    delta: Math.max(0, targetCredits - accountedCredits),
  };
}
