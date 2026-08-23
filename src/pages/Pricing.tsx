import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { trpc } from "../utils/trpc.js";

const TIER_CONFIG = {
  free: { price: 0, credits: 20, builds: 3, label: "Free" },
  starter: { price: 49, credits: 100, builds: 16, label: "Starter" },
  builder: { price: 149, credits: 400, builds: 66, label: "Builder" },
  studio: { price: 399, credits: 1500, builds: null, label: "Studio" },
  enterprise: { price: 896, credits: null, builds: null, label: "Enterprise" },
  custom: { price: null, credits: null, builds: null, label: "Custom" },
};

export function Pricing() {
  const { data: subStatus } = useQuery({
    queryKey: ["subscriptions", "status"],
    queryFn: () => trpc.subscriptions.status.query(),
  });

  const createCheckout = useMutation({
    mutationFn: (tier: keyof typeof TIER_CONFIG) =>
      trpc.subscriptions.getPaymentLink.mutate({ tier: tier as "starter" | "builder" | "studio" }),
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });

  const currentTier = subStatus?.tier ?? "free";

  const tiers = [
    {
      key: "free" as const,
      name: "Free",
      price: "$0",
      subPrice: "/month",
      description: "For hobbyists exploring AI app building",
      features: [
        "3 builds/month",
        "20 compute credits/month",
        "Basic templates",
        "Community support",
      ],
      cta: "Current Plan",
      popular: false,
      disabled: currentTier !== "free",
    },
    {
      key: "starter" as const,
      name: "Starter",
      price: "$49",
      subPrice: "/month",
      description: "Entry paid tier for individual creators",
      features: [
        "16 builds/month",
        "100 compute credits/month",
        "All templates",
        "GitHub export",
        "Vercel deploy",
        "7-day free trial",
      ],
      cta: currentTier === "starter" ? "Current Plan" : "Start Free Trial",
      popular: false,
      disabled: currentTier === "starter" || currentTier === "builder" || currentTier === "studio" || currentTier === "enterprise" || currentTier === "custom",
    },
    {
      key: "builder" as const,
      name: "Builder",
      price: "$149",
      subPrice: "/month",
      description: "Serious individual professionals",
      features: [
        "66 builds/month",
        "400 compute credits/month",
        "Priority build queue",
        "Advanced integrations",
        "Custom domains",
        "7-day free trial",
      ],
      cta: currentTier === "builder" ? "Current Plan" : "Start Free Trial",
      popular: true,
      disabled: currentTier === "builder" || currentTier === "studio" || currentTier === "enterprise" || currentTier === "custom",
    },
    {
      key: "studio" as const,
      name: "Studio",
      price: "$399",
      subPrice: "/month",
      description: "Professional teams and studios",
      features: [
        "Unlimited builds",
        "1,500 compute credits/month",
        "Team collaboration",
        "SSO & SAML",
        "Dedicated support",
        "7-day free trial",
      ],
      cta: currentTier === "studio" ? "Current Plan" : "Start Free Trial",
      popular: false,
      disabled: currentTier === "studio" || currentTier === "enterprise" || currentTier === "custom",
    },
    {
      key: "enterprise" as const,
      name: "Enterprise",
      price: "$896+",
      subPrice: "/month",
      description: "Larger organizations with custom needs",
      features: [
        "Unlimited builds & credits",
        "Custom contracts",
        "SLA guarantees",
        "Dedicated infrastructure",
        "Priority 24/7 support",
        "Custom integrations",
      ],
      cta: "Contact Sales",
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
            7-day free trial on all paid plans
          </span>
        </div>
        <h1 className="text-4xl font-bold text-center text-slate-900 dark:text-white mb-4">
          Choose Your Plan
        </h1>
        <p className="text-center text-slate-600 dark:text-slate-400 mb-12 max-w-2xl mx-auto">
          Build full-stack apps with AI. Every plan includes our multi-agent pipeline.
          Credits are consumed per build phase (Planner, Coder, Reviewer).
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
                  MOST POPULAR
                </div>
              )}
              <h2 className={`text-xl font-bold mb-2 ${tier.popular ? "text-white" : "text-slate-900 dark:text-white"}`}>
                {tier.name}
              </h2>
              <p className={`text-sm mb-4 ${tier.popular ? "text-blue-100" : "text-slate-500 dark:text-slate-400"}`}>
                {tier.description}
              </p>
              <div className="mb-6">
                <span className={`text-3xl font-bold ${tier.popular ? "text-white" : "text-slate-900 dark:text-white"}`}>
                  {tier.price}
                </span>
                <span className={tier.popular ? "text-blue-200" : "text-slate-500 dark:text-slate-400"}>
                  {tier.subPrice}
                </span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {tier.features.map((feature, idx) => (
                  <li
                    key={idx}
                    className={`flex items-center text-sm ${
                      tier.popular ? "text-blue-50" : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <span className={tier.popular ? "text-yellow-300 mr-2" : "text-green-500 mr-2"}>✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => {
                  if (tier.isEnterprise) {
                    window.location.href = "mailto:sales@appforge.dev?subject=Enterprise%20Plan%20Inquiry";
                    return;
                  }
                  if (!tier.disabled) {
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
                {createCheckout.isPending && !tier.disabled ? "Loading..." : tier.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Credit usage explainer */}
        <div className="mt-16 max-w-3xl mx-auto bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
            How Credits Work
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Each build runs through a 3-phase AI pipeline. Credits are consumed per phase:
          </p>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">2</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Planner credits</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">3</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Coder credits</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">1</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Reviewer credits</div>
            </div>
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            A typical full build uses <strong>6 credits</strong> (2 + 3 + 1). If you run out mid-build, your project pauses and you can top up credits or upgrade your plan. Unused credits roll over for 30 days.
          </p>
        </div>
      </div>
    </div>
  );
}
