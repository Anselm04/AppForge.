import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { trpc } from "../utils/trpc.js";
import { useSession } from "../lib/auth.js";
import { BUILD_CREDIT_COST, SENIOR_DEV_CREDIT_COST } from "../lib/credits.js";
import { useLocale } from "../i18n/LocaleContext.js";

const TIER_CONFIG = {
  free: { price: 0, credits: 20, builds: 3, label: "Free" },
  starter: { price: 49, credits: 100, builds: 16, label: "Starter" },
  builder: { price: 149, credits: 400, builds: 66, label: "Builder" },
  studio: { price: 399, credits: 1500, builds: null, label: "Studio" },
  enterprise: { price: 896, credits: null, builds: null, label: "Enterprise" },
  custom: { price: null, credits: null, builds: null, label: "Custom" },
};

export function Pricing() {
  const navigate = useNavigate();
  const { t } = useLocale();
  const session = useSession();
  const { data: user } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => trpc.auth.me.query(),
  });
  const isAuthed = !!user || !!session;
  const { data: subStatus } = useQuery({
    queryKey: ["subscriptions", "status"],
    queryFn: () => trpc.subscriptions.status.query(),
    enabled: isAuthed,
    retry: false,
  });

  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const createCheckout = useMutation({
    mutationFn: async (tier: keyof typeof TIER_CONFIG) => {
      if (tier === "enterprise" || tier === "custom") {
        const origin = window.location.origin;
        return trpc.subscriptions.createCheckoutSession.mutate({
          tier,
          successUrl: `${origin}/dashboard?checkout=success`,
          cancelUrl: `${origin}/pricing?checkout=cancel`,
          trialDays: tier === "enterprise" ? 14 : 7,
        });
      }
      return trpc.subscriptions.getPaymentLink.mutate({
        tier: tier as "starter" | "builder" | "studio",
      });
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      } else {
        setCheckoutError("Checkout did not return a payment URL.");
      }
    },
    onError: (err) => {
      setCheckoutError(err instanceof Error ? err.message : "Checkout failed");
    },
  });

  const buyCredits = useMutation({
    mutationFn: (credits: number) =>
      trpc.subscriptions.buyCredits.mutate({ credits }),
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      } else {
        setCheckoutError("Checkout did not return a payment URL.");
      }
    },
    onError: (err) => {
      setCheckoutError(
        err instanceof Error ? err.message : "Credit checkout failed",
      );
    },
  });

  const currentTier = subStatus?.tier ?? "free";

  const tiers = [
    {
      key: "free" as const,
      name: t("pricing.freeName"),
      price: "$0",
      subPrice: t("pricing.perMonth"),
      description: t("pricing.freeDesc"),
      features: [
        t("pricing.freeF1"),
        t("pricing.freeF2"),
        t("pricing.freeF3"),
        t("pricing.freeF4"),
      ],
      cta: t("pricing.currentPlan"),
      popular: false,
      disabled: currentTier !== "free",
    },
    {
      key: "starter" as const,
      name: t("pricing.starterName"),
      price: "$49",
      subPrice: t("pricing.perMonth"),
      description: t("pricing.starterDesc"),
      features: [
        t("pricing.starterF1"),
        t("pricing.starterF2"),
        t("pricing.starterF3"),
        t("pricing.starterF4"),
        t("pricing.starterF5"),
        t("pricing.starterF6"),
      ],
      cta:
        currentTier === "starter"
          ? t("pricing.currentPlan")
          : t("pricing.startTrial"),
      popular: false,
      disabled:
        currentTier === "starter" ||
        currentTier === "builder" ||
        currentTier === "studio" ||
        currentTier === "enterprise" ||
        currentTier === "custom",
    },
    {
      key: "builder" as const,
      name: t("pricing.builderName"),
      price: "$149",
      subPrice: t("pricing.perMonth"),
      description: t("pricing.builderDesc"),
      features: [
        t("pricing.builderF1"),
        t("pricing.builderF2"),
        t("pricing.builderF3"),
        t("pricing.builderF4"),
        t("pricing.builderF5"),
        t("pricing.builderF6"),
      ],
      cta:
        currentTier === "builder"
          ? t("pricing.currentPlan")
          : t("pricing.startTrial"),
      popular: true,
      disabled:
        currentTier === "builder" ||
        currentTier === "studio" ||
        currentTier === "enterprise" ||
        currentTier === "custom",
    },
    {
      key: "studio" as const,
      name: t("pricing.studioName"),
      price: "$399",
      subPrice: t("pricing.perMonth"),
      description: t("pricing.studioDesc"),
      features: [
        t("pricing.studioF1"),
        t("pricing.studioF2"),
        t("pricing.studioF3"),
        t("pricing.studioF4"),
        t("pricing.studioF5"),
        t("pricing.studioF6"),
      ],
      cta:
        currentTier === "studio"
          ? t("pricing.currentPlan")
          : t("pricing.startTrial"),
      popular: false,
      disabled:
        currentTier === "studio" ||
        currentTier === "enterprise" ||
        currentTier === "custom",
    },
    {
      key: "enterprise" as const,
      name: t("pricing.enterpriseName"),
      price: "$896+",
      subPrice: t("pricing.perMonth"),
      description: t("pricing.enterpriseDesc"),
      features: [
        t("pricing.enterpriseF1"),
        t("pricing.enterpriseF2"),
        t("pricing.enterpriseF3"),
        t("pricing.enterpriseF4"),
        t("pricing.enterpriseF5"),
        t("pricing.enterpriseF6"),
      ],
      cta: t("pricing.contactSales"),
      popular: false,
      disabled: false,
      isEnterprise: true,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-4">
          <span className="inline-block bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 px-3 py-1 rounded-full text-sm font-semibold">
            {t("pricing.trialBadge")}
          </span>
        </div>
        <h1 className="text-4xl font-bold text-center text-slate-900 dark:text-white mb-4">
          {t("pricing.title")}
        </h1>
        <p className="text-center text-slate-600 dark:text-slate-400 mb-4 max-w-2xl mx-auto">
          {t("pricing.subtitle")}
        </p>
        <p className="text-center text-sm text-slate-500 dark:text-slate-500 mb-12 max-w-2xl mx-auto">
          Builds reserve {BUILD_CREDIT_COST} credits each when they start.
          Senior Dev sessions cost {SENIOR_DEV_CREDIT_COST} credits. Enterprise
          is sales-led — contact us below (no self-serve checkout).
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 max-w-7xl mx-auto">
          {tiers.map((tier) => (
            <div
              key={tier.key}
              className={`relative rounded-xl shadow-lg p-6 flex flex-col ${
                tier.popular
                  ? "bg-blue-600 text-white scale-105 md:scale-100 z-10"
                  : "bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-bold">
                  {t("pricing.mostPopular")}
                </div>
              )}
              <h2
                className={`text-xl font-bold mb-2 ${tier.popular ? "text-white" : "text-slate-900 dark:text-white"}`}
              >
                {tier.name}
              </h2>
              <p
                className={`text-sm mb-4 ${tier.popular ? "text-blue-100" : "text-slate-500 dark:text-slate-400"}`}
              >
                {tier.description}
              </p>
              <div className="mb-6">
                <span
                  className={`text-3xl font-bold ${tier.popular ? "text-white" : "text-slate-900 dark:text-white"}`}
                >
                  {tier.price}
                </span>
                <span
                  className={
                    tier.popular
                      ? "text-blue-200"
                      : "text-slate-500 dark:text-slate-400"
                  }
                >
                  {tier.subPrice}
                </span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {tier.features.map((feature, idx) => (
                  <li
                    key={idx}
                    className={`flex items-center text-sm ${
                      tier.popular
                        ? "text-blue-50"
                        : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <span
                      className={
                        tier.popular
                          ? "text-yellow-300 mr-2"
                          : "text-green-500 mr-2"
                      }
                    >
                      ✓
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => {
                  if (!isAuthed) {
                    navigate("/signup?next=/pricing");
                    return;
                  }
                  if (!tier.disabled) {
                    setCheckoutError(null);
                    createCheckout.mutate(tier.key);
                  }
                }}
                disabled={tier.disabled || createCheckout.isPending}
                className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                  tier.popular
                    ? "bg-white text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                    : tier.disabled
                      ? "bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                }`}
              >
                {createCheckout.isPending && !tier.disabled
                  ? t("pricing.loading")
                  : tier.cta}
              </button>
            </div>
          ))}
        </div>

        <div
          id="credits"
          className="mt-16 max-w-3xl mx-auto bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8"
        >
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            {t("pricing.buyTitle")}
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm">
            {t("pricing.buySubtitle")}
          </p>
          {checkoutError && (
            <p
              className="text-sm text-red-600 dark:text-red-400 mb-4"
              role="alert"
            >
              {checkoutError}
            </p>
          )}
          {createCheckout.isError && !checkoutError && (
            <p
              className="text-sm text-red-600 dark:text-red-400 mb-4"
              role="alert"
            >
              {String(
                (createCheckout.error as Error)?.message || "Checkout failed",
              )}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[50, 100, 250].map((pack) => (
              <button
                key={pack}
                onClick={() => {
                  if (!isAuthed) {
                    navigate("/signup?next=/pricing");
                    return;
                  }
                  setCheckoutError(null);
                  buyCredits.mutate(pack);
                }}
                disabled={buyCredits.isPending}
                className="border border-slate-200 dark:border-slate-600 rounded-lg p-4 hover:border-blue-500 transition-colors disabled:opacity-50"
              >
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {pack}
                </div>
                <div className="text-sm text-slate-500 mb-3">
                  {t("pricing.packCredits", { n: pack })}
                </div>
                <span className="text-blue-600 font-semibold text-sm">
                  {buyCredits.isPending
                    ? t("pricing.loading")
                    : t("pricing.buy")}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-16 max-w-3xl mx-auto bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
            {t("pricing.howTitle")}
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            {t("pricing.howIntro")}
          </p>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                2
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {t("pricing.planner")}
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                3
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {t("pricing.coder")}
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                1
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {t("pricing.reviewer")}
              </div>
            </div>
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            {t("pricing.howFooter")}
          </p>
        </div>
      </div>
    </div>
  );
}
