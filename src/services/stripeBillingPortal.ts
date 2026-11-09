import type Stripe from "stripe";
import {
  APPROVED_MONTHLY_PRICE_IDS,
  MONTHLY_PLAN_USD_CENTS,
  assertAppForgePrice,
} from "./appForgePricePolicy.js";

const PORTAL_VERSION = "2";
const MANAGED_METADATA_KEY = "appforge_managed_portal";

function requiredPriceIds(): string[] {
  return [
    APPROVED_MONTHLY_PRICE_IDS.starter,
    APPROVED_MONTHLY_PRICE_IDS.builder,
    APPROVED_MONTHLY_PRICE_IDS.studio,
  ];
}

function productIdForPrice(price: Stripe.Price): string {
  if (typeof price.product === "string") return price.product;
  if ("id" in price.product) return price.product.id;
  throw new Error(
    `Stripe price ${price.id} does not reference a valid product.`,
  );
}

export async function ensureAppForgeBillingPortalConfiguration(
  stripe: Stripe,
  appUrl: string,
): Promise<string> {
  const activeConfigurations = await stripe.billingPortal.configurations.list({
    active: true,
    limit: 100,
  });

  const existing = activeConfigurations.data.find(
    (configuration) =>
      configuration.metadata?.[MANAGED_METADATA_KEY] === PORTAL_VERSION,
  );
  if (existing) return existing.id;

  const prices = await Promise.all(
    requiredPriceIds().map((priceId) => stripe.prices.retrieve(priceId)),
  );

  (["starter", "builder", "studio"] as const).forEach((tier, index) => {
    assertAppForgePrice(
      prices[index],
      MONTHLY_PLAN_USD_CENTS[tier],
      "recurring",
      process.env.NODE_ENV === "production",
    );
  });

  const products = prices.map((price) => ({
    product: productIdForPrice(price),
    prices: [price.id],
  }));

  const configuration = await stripe.billingPortal.configurations.create({
    business_profile: {
      headline: "Manage your AppForge subscription",
    },
    default_return_url: `${appUrl}/dashboard`,
    features: {
      customer_update: {
        enabled: true,
        allowed_updates: ["address", "email", "name"],
      },
      invoice_history: {
        enabled: true,
      },
      payment_method_update: {
        enabled: true,
      },
      subscription_cancel: {
        enabled: true,
        mode: "at_period_end",
        cancellation_reason: {
          enabled: true,
          options: [
            "too_expensive",
            "missing_features",
            "switched_service",
            "unused",
            "other",
          ],
        },
      },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        proration_behavior: "create_prorations",
        products,
      },
    },
    metadata: {
      [MANAGED_METADATA_KEY]: PORTAL_VERSION,
      app: "appforge",
      managed_by: "appforge",
    },
  });

  return configuration.id;
}
