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

type PaidTier = "starter" | "builder" | "studio" | "enterprise";
type CreditPack = 50 | 100 | 250;

const CREDIT_PACKS: readonly CreditPack[] = [50, 100, 250];
const ENTERPRISE_CONTACT = "/help?topic=enterprise";
const PRICING_PROPOSAL_MODE = true;
const PRICING_BUDGET_DISCLOSURE =
  "Your subscription includes a limited monthly credit allowance, not unlimited builds. If you use all included and previously purchased credits before your next monthly subscription payment, AppForge pauses credit-consuming work. To continue building before the next monthly credit refill, you must separately purchase enough top-up credits at the displayed USD price, or choose an eligible higher plan. If you do not purchase more credits, the work stays paused until new credits become available. Top-ups are never automatic, and complex builds may need additional credits even within the same billing month.";

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
    mutationFn: (tier: PaidTier) =>
      trpc.subscriptions.createCheckoutSession.mutate({ tier }),
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
    mutationFn: (credits: CreditPack) =>
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

  const manageBilling = useMutation({
    mutationFn: () => trpc.subscriptions.billingPortal.mutate(),
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      } else {
        setCheckoutError("Stripe did not return a billing portal URL.");
      }
    },
    onError: (err) => {
      setCheckoutError(
        err instanceof Error ? err.message : "Unable to open billing portal.",
      );
    },
  });

  const currentTier = subStatus?.tier ?? "free";
  const hasManagedSubscription =
    !!subStatus?.stripeCustomerId && !!subStatus?.isPaid;

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
        currentTier === "starter" ? t("pricing.currentPlan") : t("pricing.buy"),
      popular: false,
      disabled:
        PRICING_PROPOSAL_MODE ||
        currentTier === "starter" ||
        currentTier === "builder" ||
        currentTier === "studio" ||
        currentTier === "enterprise",
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
        currentTier === "builder" ? t("pricing.currentPlan") : t("pricing.buy"),
      popular: true,
      disabled:
        PRICING_PROPOSAL_MODE ||
        currentTier === "builder" ||
        currentTier === "studio" ||
        currentTier === "enterprise",
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
        currentTier === "studio" ? t("pricing.currentPlan") : t("pricing.buy"),
      popular: false,
      disabled:
        PRICING_PROPOSAL_MODE ||
        currentTier === "studio" ||
        currentTier === "enterprise",
    },
    {
      key: "enterprise" as const,
      name: t("pricing.enterpriseName"),
      price: "$2,499+",
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
      cta:
        currentTier === "enterprise"
          ? t("pricing.currentPlan")
          : t("pricing.contactSales"),
      popular: false,
      disabled: currentTier === "enterprise",
    },
  ];

  return (
    <div className="forge-section">
      <div className="forge-container">
        <div className="text-center mb-4">
          <Badge tone="success">Secure checkout powered by Stripe</Badge>
        </div>
        {PRICING_PROPOSAL_MODE && (
          <p className="text-center text-sm text-forge-text-muted mb-4">
            PROPOSED USD PRICES — FOR OWNER REVIEW ONLY. Subscription checkout
            is disabled until billing, cost limits and Stripe prices are
            approved.
          </p>
        )}
        <h1 className="forge-h1 text-center mb-4">{t("pricing.title")}</h1>
        <p className="text-center text-forge-text-muted mb-4 max-w-2xl mx-auto">
          {t("pricing.subtitle")}
        </p>
        <p className="text-center text-sm text-forge-text-muted mb-6 max-w-2xl mx-auto">
          {t("pricing.creditsNote", {
            buildCost: BUILD_CREDIT_COST,
            seniorCost: SENIOR_DEV_CREDIT_COST,
          })}
        </p>

        <div className="mx-auto mb-10 max-w-3xl rounded-2xl border border-forge-border bg-forge-surface px-5 py-4 text-sm leading-6 text-forge-text-muted">
          <p className="font-semibold text-forge-text-primary">
            Plan your budget before you build
          </p>
          <p className="mt-1">{PRICING_BUDGET_DISCLOSURE}</p>
          <p className="mt-2 font-semibold text-forge-text-primary">
            Monthly subscription fees and credit top-ups are separate payments.
            All amounts are in USD; applicable taxes and any external vendor
            charges are additional where disclosed.
          </p>
        </div>

        {subStatus?.stripeCustomerId && (
          <div className="mb-10 flex flex-col items-center gap-3">
            <p className="text-sm text-forge-text-muted text-center">
              Current Stripe plan:{" "}
              <span className="capitalize">{currentTier}</span>
            </p>
            <Button
              variant="secondary"
              size="sm"
              disabled={manageBilling.isPending}
              loading={manageBilling.isPending}
              onClick={() => {
                setCheckoutError(null);
                manageBilling.mutate();
              }}
            >
              Manage billing & subscription
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {tiers.map((tier) => (
            <GlassCard
              key={tier.key}
              hover={!tier.disabled}
              className={cn(
                "relative flex flex-col",
                tier.popular && "forge-gradient-border z-10",
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
                <span className="text-forge-text-muted">
                  {tier.subPrice} USD
                </span>
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
                  if (tier.key === "enterprise" && !tier.disabled) {
                    window.location.href = ENTERPRISE_CONTACT;
                    return;
                  }
                  if (!isAuthed) {
                    navigate("/signup?next=/pricing");
                    return;
                  }
                  if (tier.key !== "free" && !tier.disabled) {
                    setCheckoutError(null);
                    if (hasManagedSubscription) {
                      manageBilling.mutate();
                      return;
                    }
                    createCheckout.mutate(tier.key);
                  }
                }}
                disabled={
                  tier.disabled ||
                  createCheckout.isPending ||
                  manageBilling.isPending
                }
                loading={
                  !tier.disabled &&
                  (createCheckout.isPending || manageBilling.isPending)
                }
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
          <h3 className="forge-h2 mb-2">{t("pricing.buyTitle")} (USD)</h3>
          <p className="text-forge-text-muted mb-6 text-sm">
            {t("pricing.buySubtitle")}
          </p>
          <p className="mb-6 text-sm font-semibold text-forge-text-primary">
            Run out before your next monthly payment? To keep building now, buy
            more credits separately. Otherwise your build pauses until credits
            become available again. Nothing is purchased automatically.
          </p>
          {checkoutError && (
            <p className="text-sm text-red-500 mb-4" role="alert">
              {checkoutError}
            </p>
          )}
          <p className="mb-4 text-sm text-forge-text-muted" role="status">
            Top-up purchases are unavailable until the exact USD prices and
            included credit allowances are approved. No charge will be made.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {CREDIT_PACKS.map((pack) => (
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
                disabled={PRICING_PROPOSAL_MODE || buyCredits.isPending}
                className="rounded-xl border border-forge-border bg-forge-bg/40 p-4 text-left transition-colors hover:border-forge-cyan/40 disabled:opacity-50"
              >
                <div className="text-2xl font-bold text-forge-text-primary">
                  {pack}
                </div>
                <div className="text-sm text-forge-text-muted mb-3">
                  {t("pricing.packCredits", { n: pack })} · USD price awaiting
                  approval
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
