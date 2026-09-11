import type Stripe from "stripe";

const PORTAL_VERSION = "1";
const MANAGED_METADATA_KEY = "appforge_managed_portal";

function requiredPriceIds(): string[] {
  const ids = [
    process.env.STRIPE_STARTER_PRICE_ID,
    process.env.STRIPE_BUILDER_PRICE_ID,
    process.env.STRIPE_STUDIO_PRICE_ID,
  ];

  if (ids.some((id) => !id)) {
    throw new Error(
      "AppForge billing portal requires STRIPE_STARTER_PRICE_ID, STRIPE_BUILDER_PRICE_ID, and STRIPE_STUDIO_PRICE_ID.",
    );
  }

  return ids as string[];
}

function productIdForPrice(price: Stripe.Price): string {
  if (typeof price.product === "string") return price.product;
  if ("id" in price.product) return price.product.id;
  throw new Error(`Stripe price ${price.id} does not reference a valid product.`);
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
