import {
  COMPETITOR_LABELS,
  PLATFORM_FEATURE_MATRIX,
  appforgeExclusiveCount,
  capabilitySummary,
  scorePlatform,
} from "../lib/platformComparison.js";

function cell(v: boolean | "partial" | "studio"): string {
  if (v === true || v === "studio") return "✓";
  if (v === "partial") return "~";
  return "—";
}

export function CapabilityCoveragePanel() {
  const scores = scorePlatform("appforge");
  const exclusive = appforgeExclusiveCount();
  const caps = capabilitySummary();

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-5 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          What AppForge can build
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
          {caps.length} composable capabilities — combine any stack with video,
          graphics, music, marketing, AR, courses, inventions, and architecture.{" "}
          {exclusive}+ features are full or studio-grade on AppForge vs partial
          or absent elsewhere.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          AppForge score: {scores.full} full / {scores.partial} partial out of{" "}
          {scores.total} tracked features
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {caps.map((c) => (
          <span
            key={c.id}
            className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
          >
            {c.icon} {c.label}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-600">
              <th className="text-left py-2 pe-3 font-semibold">Feature</th>
              <th className="py-2 px-2 font-semibold text-blue-600">
                AppForge
              </th>
              {Object.entries(COMPETITOR_LABELS).map(([id, label]) => (
                <th key={id} className="py-2 px-2 font-medium text-slate-500">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PLATFORM_FEATURE_MATRIX.map((row) => (
              <tr
                key={row.id}
                className="border-b border-slate-100 dark:border-slate-700/80"
              >
                <td className="py-2 pe-3 text-slate-700 dark:text-slate-300">
                  <span className="text-slate-400">{row.category} · </span>
                  {row.feature}
                </td>
                <td className="py-2 px-2 text-center font-semibold text-blue-600">
                  {cell(row.appforge)}
                </td>
                <td className="py-2 px-2 text-center text-slate-500">
                  {cell(row.bolt)}
                </td>
                <td className="py-2 px-2 text-center text-slate-500">
                  {cell(row.replit)}
                </td>
                <td className="py-2 px-2 text-center text-slate-500">
                  {cell(row.lovable)}
                </td>
                <td className="py-2 px-2 text-center text-slate-500">
                  {cell(row.v0)}
                </td>
                <td className="py-2 px-2 text-center text-slate-500">
                  {cell(row.github_copilot)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-slate-400 mt-2">
          ✓ full · ~ partial · — not available
        </p>
      </div>
    </section>
  );
}
