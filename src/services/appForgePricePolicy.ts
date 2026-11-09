/**
 * Enforce advertised amounts before customers enter Stripe Checkout.
 * This protects against accidentally charging a different currency/amount
 * or using a one-off price for a subscription. It does not prove profit.
 */
export const MONTHLY_PLAN_USD_CENTS = {
  starter: 7900,
  builder: 19900,
  studio: 49900,
} as const;

/** Verified live Stripe catalogue. IDs identify prices; they are not secrets. */
export const APPROVED_MONTHLY_PRICE_IDS = {
  starter: "price_1UZgVGKFfiU4ONpqL0LO2pH9",
  builder: "price_1UZgVPKFfiU4ONpqN5INcwKW",
  studio: "price_1UZgVRKFfiU4ONpq1bD9dZgZ",
} as const;

export const AFTERCARE_PLUS_USD_CENTS = 1900;
export const AFTERCARE_PLUS_PRICE_ID = "price_1UZgVTKFfiU4ONpqDTuE9TB7";

/** Enterprise begins at $2,499/month and requires a signed individual quote. */
export const ENTERPRISE_MINIMUM_USD_CENTS = 249900;

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
