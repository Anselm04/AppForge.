/**
 * Pure credit exhaustion gate. The caller holds the user-scoped database
 * transaction lock before reading the balance, and must not write usage when
 * this check fails.
 */
export function assertSufficientCreditBalance(
  balance: number,
  amount: number,
): void {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Credit deduction amount must be a positive integer");
  }
  if (!Number.isSafeInteger(balance) || balance < 0) {
    throw new Error("Invalid credit balance");
  }
  if (balance < amount) {
    throw new Error(`Insufficient credits: need ${amount}, have ${balance}`);
  }
}
