import { useQuery } from "@tanstack/react-query";
import { trpc } from "../utils/trpc.js";

type Props = {
  projectId: number;
  enabled?: boolean;
};

export function RevenueReadinessPanel({ projectId, enabled = true }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["projects", projectId, "revenueReadiness"],
    queryFn: () => trpc.projects.revenueReadiness.query({ id: projectId }),
    enabled: enabled && projectId > 0,
  });

  if (!enabled || projectId <= 0) return null;
  if (isLoading) {
    return (
      <div className="mt-4 bg-slate-800/80 border border-slate-600 rounded-lg p-4 text-slate-400 text-sm">
        Scanning revenue readiness…
      </div>
    );
  }
  if (!data) return null;

  const statusColor = {
    done: "text-green-400",
    partial: "text-amber-400",
    missing: "text-red-400",
  } as const;

  return (
    <div className="mt-4 bg-slate-800/80 border border-slate-600 rounded-lg p-4 text-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="font-semibold text-lg">Revenue readiness</h3>
        <p className="text-sm text-slate-300">
          Score:{" "}
          <span className="font-mono text-white">
            {data.percent}% ({data.score}/{data.maxScore})
          </span>
        </p>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        What separates a demo from a product that can earn income. Complete
        missing items before switching Stripe to live mode.
      </p>

      {data.needsBillingScaffold && (
        <p className="text-sm text-amber-300 mb-3 bg-amber-900/20 border border-amber-800 rounded px-3 py-2">
          Enable the Fintech capability or describe a paid product — the build
          pipeline merges Stripe checkout, webhook, and entitlements scaffolds.
        </p>
      )}

      <ul className="space-y-2 text-sm mb-4">
        {data.items.map((item) => (
          <li
            key={item.id}
            className="border border-slate-700 rounded px-3 py-2 bg-slate-900/40"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium">{item.label}</span>
              <span className={`text-xs uppercase ${statusColor[item.status]}`}>
                {item.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">{item.why}</p>
            <p className="text-xs text-slate-500 mt-1">→ {item.how}</p>
          </li>
        ))}
      </ul>

      {data.platformGaps.length > 0 && (
        <details className="text-sm mb-4">
          <summary className="cursor-pointer text-slate-300 hover:text-white">
            Platform roadmap (honest gaps)
          </summary>
          <ul className="mt-2 space-y-2 text-xs text-slate-400">
            {data.platformGaps.map((gap) => (
              <li key={gap.id}>
                <span className="text-slate-300">{gap.label}</span> — {gap.why}
              </li>
            ))}
          </ul>
        </details>
      )}

      {data.billingGoldenPath && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-slate-300 mb-2">
            Billing golden path{" "}
            <span
              className={
                data.billingGoldenPath.passed
                  ? "text-green-400"
                  : "text-amber-400"
              }
            >
              {data.billingGoldenPath.passed ? "complete" : "in progress"}
            </span>
          </h4>
          <ul className="space-y-1 text-xs">
            {data.billingGoldenPath.checks.map((check) => (
              <li
                key={check.id}
                className={check.passed ? "text-green-400" : "text-slate-400"}
              >
                {check.passed ? "✓" : "○"} {check.label}
                {!check.passed && check.hint && (
                  <span className="text-slate-500"> — {check.hint}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.goLiveSteps.length > 0 && data.stripeDetected && (
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-2">
            Go-live checklist (Stripe)
          </h4>
          <ol className="list-decimal list-inside space-y-1 text-xs text-slate-400">
            {data.goLiveSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
