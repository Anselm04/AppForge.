import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { trpc } from "../utils/trpc";

export function Pricing() {
  const { data: subStatus } = useQuery({
    queryKey: ["subscriptions", "status"],
    queryFn: () => trpc.subscriptions.status.query(),
  });

  const createCheckout = useMutation({
    mutationFn: (priceId: string) =>
      trpc.subscriptions.createCheckout.mutate({
        priceId,
        successUrl: `${window.location.origin}/dashboard?success=true`,
        cancelUrl: window.location.href,
      }),
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-center text-slate-900 dark:text-white mb-12">
          Choose Your Plan
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Free Tier */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
              Free
            </h2>
            <p className="text-4xl font-bold text-blue-600 mb-6">$0</p>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center text-slate-600 dark:text-slate-300">
                <span className="text-green-500 mr-2">✓</span> 3 builds/month
              </li>
              <li className="flex items-center text-slate-600 dark:text-slate-300">
                <span className="text-green-500 mr-2">✓</span> Basic templates
              </li>
              <li className="flex items-center text-slate-400 line-through">
                <span className="text-gray-400 mr-2">✗</span> GitHub export
              </li>
              <li className="flex items-center text-slate-400 line-through">
                <span className="text-gray-400 mr-2">✗</span> Cosine Genie 2
              </li>
            </ul>
            <button
              disabled={!subStatus?.isPro === false}
              className="w-full bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 text-slate-900 dark:text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
            >
              Current Plan
            </button>
          </div>

          {/* Pro Tier */}
          <div className="bg-blue-600 rounded-xl shadow-xl p-8 transform scale-105 md:scale-100">
            <div className="bg-blue-700 text-white px-3 py-1 rounded-full text-sm font-semibold inline-block mb-4">
              RECOMMENDED
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Pro</h2>
            <p className="text-5xl font-bold text-white mb-6">$29<span className="text-lg">/mo</span></p>
            <ul className="space-y-3 mb-8 text-white">
              <li className="flex items-center">
                <span className="text-yellow-300 mr-2">✓</span> Unlimited builds
              </li>
              <li className="flex items-center">
                <span className="text-yellow-300 mr-2">✓</span> Advanced templates
              </li>
              <li className="flex items-center">
                <span className="text-yellow-300 mr-2">✓</span> GitHub export
              </li>
              <li className="flex items-center">
                <span className="text-yellow-300 mr-2">✓</span> Cosine Genie 2 improvements
              </li>
            </ul>
            <button
              onClick={() => createCheckout.mutate("price_pro_monthly")}
              disabled={createCheckout.isPending || subStatus?.isPro}
              className="w-full bg-white hover:bg-slate-100 text-blue-600 px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
            >
              {createCheckout.isPending ? "Loading..." : subStatus?.isPro ? "Current Plan" : "Upgrade to Pro"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
