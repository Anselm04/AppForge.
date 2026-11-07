/**
 * Owner-approved AppForge provider credit allocations. One credit represents
 * one cent of provider-cost authority. Enterprise has no default allowance.
 */
export const INCLUDED_PROVIDER_CREDIT_CENTS = {
  free: 0,
  starter: 1200,
  builder: 3500,
  studio: 9500,
} as const;

export const PURCHASED_PROVIDER_CREDIT_PACKS_CENTS = [
  1000, 3000, 8000,
] as const;

export const PURCHASED_PROVIDER_CREDIT_PACK_PRICES_USD_CENTS = {
  1000: 2500,
  3000: 6900,
  8000: 16900,
} as const;

export type ProviderCreditPackCents =
  (typeof PURCHASED_PROVIDER_CREDIT_PACKS_CENTS)[number];

export const PROVIDER_CREDIT_PACK_PRICE_ID_ENV: Record<
  ProviderCreditPackCents,
  string
> = {
  1000: "STRIPE_PROVIDER_CREDITS_1000_PRICE_ID",
  3000: "STRIPE_PROVIDER_CREDITS_3000_PRICE_ID",
  8000: "STRIPE_PROVIDER_CREDITS_8000_PRICE_ID",
};

export const PROVIDER_CREDIT_TOP_UP_PERIOD_LIMIT_USD_CENTS = 50000;

export type ProviderCreditTier = keyof typeof INCLUDED_PROVIDER_CREDIT_CENTS;
