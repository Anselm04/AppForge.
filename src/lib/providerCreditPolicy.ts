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

export type ProviderCreditTier = keyof typeof INCLUDED_PROVIDER_CREDIT_CENTS;
