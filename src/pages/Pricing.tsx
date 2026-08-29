import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { trpc } from "../utils/trpc.js";
import { useSession } from "../lib/auth.js";
import { BUILD_CREDIT_COST, SENIOR_DEV_CREDIT_COST } from "../lib/credits.js";
import { useLocale } from "../i18n/LocaleContext.js";
import { Button } from "../design-system/Button.js";
import { GlassCard } from "../design-system/GlassCard.js";
import { Badge } from "../design-system/Badge.js";
import { cn } from "../lib/cn.js";

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
        setCheckoutError(t("pricing.checkoutNoUrl"));
      }
    },
    onError: (err) => {
      setCheckoutError(
        err instanceof Error ? err.message : t("pricing.checkoutFailed"),
      );
    },
  });

  const buyCredits = useMutation({
    mutationFn: (credits: number) =>
      trpc.subscriptions.buyCredits.mutate({ credits }),
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      } else {
        setCheckoutError(t("pricing.checkoutNoUrl"));
      }
    },
    onError: (err) => {
      setCheckoutError(
        err instanceof Error ? err.message : t("pricing.creditCheckoutFailed"),
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
    <div className="forge-section">
      <div className="forge-container">
        <div className="text-center mb-4">
          <Badge tone="success">{t("pricing.trialBadge")}</Badge>
        </div>
        <h1 className="forge-h1 text-center mb-4">{t("pricing.title")}</h1>
        <p className="text-center text-forge-text-muted mb-4 max-w-2xl mx-auto">
          {t("pricing.subtitle")}
        </p>
        <p className="text-center text-sm text-forge-text-muted mb-12 max-w-2xl mx-auto">
          {t("pricing.creditsNote", {
            buildCost: BUILD_CREDIT_COST,
            seniorCost: SENIOR_DEV_CREDIT_COST,
          })}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {tiers.map((tier) => (
            <GlassCard
              key={tier.key}
              hover={!tier.disabled}
              className={cn(
                "relative flex flex-col",
                tier.popular &&
                  "forge-gradient-border bg-forge-gradient/10 lg:scale-[1.02] z-10",
              )}
            >
              {tier.popular && (
                <Badge
                  tone="gold"
                  className="absolute -top-3 left-1/2 -translate-x-1/2"
                >
                  {t("pricing.mostPopular")}
                </Badge>
              )}
              <h2 className="text-xl font-semibold mb-2 text-forge-text-primary">
                {tier.name}
              </h2>
              <p className="text-sm mb-4 text-forge-text-muted">
                {tier.description}
              </p>
              <div className="mb-6">
                <span className="text-3xl font-bold text-forge-text-primary">
                  {tier.price}
                </span>
                <span className="text-forge-text-muted">{tier.subPrice}</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {tier.features.map((feature, idx) => (
                  <li
                    key={idx}
                    className="flex items-start text-sm text-forge-text-muted"
                  >
                    <span className="text-forge-cyan mr-2 mt-0.5">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                variant={
                  tier.popular
                    ? "primary"
                    : tier.disabled
                      ? "ghost"
                      : "secondary"
                }
                className="w-full"
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
                loading={createCheckout.isPending && !tier.disabled}
              >
                {tier.cta}
              </Button>
            </GlassCard>
          ))}
        </div>

        <GlassCard
          id="credits"
          className="mt-16 max-w-3xl mx-auto"
          hover={false}
        >
          <h3 className="forge-h2 mb-2">{t("pricing.buyTitle")}</h3>
          <p className="text-forge-text-muted mb-6 text-sm">
            {t("pricing.buySubtitle")}
          </p>
          {checkoutError && (
            <p className="text-sm text-red-500 mb-4" role="alert">
              {checkoutError}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[50, 100, 250].map((pack) => (
              <button
                key={pack}
                type="button"
                onClick={() => {
                  if (!isAuthed) {
                    navigate("/signup?next=/pricing");
                    return;
                  }
                  setCheckoutError(null);
                  buyCredits.mutate(pack);
                }}
                disabled={buyCredits.isPending}
                className="rounded-xl border border-forge-border bg-forge-bg/40 p-4 text-left transition-colors hover:border-forge-cyan/40 disabled:opacity-50"
              >
                <div className="text-2xl font-bold text-forge-text-primary">
                  {pack}
                </div>
                <div className="text-sm text-forge-text-muted mb-3">
                  {t("pricing.packCredits", { n: pack })}
                </div>
                <span className="text-forge-cyan font-semibold text-sm">
                  {buyCredits.isPending
                    ? t("pricing.loading")
                    : t("pricing.buy")}
                </span>
              </button>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="mt-8 max-w-3xl mx-auto" hover={false}>
          <h3 className="forge-h2 mb-4">{t("pricing.howTitle")}</h3>
          <p className="text-forge-text-muted mb-4">{t("pricing.howIntro")}</p>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { value: 2, label: t("pricing.planner") },
              { value: 3, label: t("pricing.coder") },
              { value: 1, label: t("pricing.reviewer") },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-forge-border bg-forge-bg/40 p-4 text-center"
              >
                <div className="text-2xl font-bold text-forge-cyan">
                  {item.value}
                </div>
                <div className="text-sm text-forge-text-muted">
                  {item.label}
                </div>
              </div>
            ))}
          </div>
          <p className="text-forge-text-muted text-sm">
            {t("pricing.howFooter")}
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
