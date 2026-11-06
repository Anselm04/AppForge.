/**
 * A monthly plan grant adds to the customer's existing credit balance.
 * The existing balance may include separately purchased packs; replacing it
 * would silently confiscate those prepaid credits.
 */
export function balanceAfterMonthlyGrant(balance: number, grant: number): number {
  if (
    !Number.isSafeInteger(balance) ||
    balance < 0 ||
    !Number.isSafeInteger(grant) ||
    grant < 0 ||
    !Number.isSafeInteger(balance + grant)
  ) {
    throw new Error("Invalid monthly credit grant or balance");
  }
  return balance + grant;
}
