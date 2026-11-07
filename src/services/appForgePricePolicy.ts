/**
 * Enforce advertised amounts before customers enter Stripe Checkout.
 * This protects against accidentally charging a different currency/amount
 * or using a one-off price for a subscription. It does not prove profit.
 */
export const MONTHLY_PLAN_USD_CENTS = {
  starter: 4900,
  builder: 14900,
  studio: 39900,
} as const;

export const TOPUP_USD_CENTS = {
  50: 10000,
  100: 20000,
  250: 50000,
} as const;

export type PriceSnapshot = {
  active?: boolean;
  currency?: string;
  unit_amount?: number | null;
  type?: string;
  recurring?: { interval?: string; interval_count?: number } | null;
  livemode?: boolean;
};

export function assertAppForgePrice(
  price: PriceSnapshot,
  expectedCents: number,
  type: "one_time" | "recurring",
  production: boolean,
): void {
  if (!Number.isSafeInteger(expectedCents) || expectedCents <= 0) {
    throw new Error("AppForge price configuration is invalid");
  }
  const correctFrequency =
    type === "recurring"
      ? price.recurring?.interval === "month" &&
        (price.recurring?.interval_count ?? 1) === 1
      : !price.recurring;
  if (
    price.active !== true ||
    price.currency?.toLowerCase() !== "usd" ||
    price.unit_amount !== expectedCents ||
    price.type !== type ||
    !correctFrequency ||
    (production && price.livemode !== true)
  ) {
    throw new Error(
      "AppForge Stripe Price does not match the published USD amount or billing terms; checkout paused",
    );
  }
}
