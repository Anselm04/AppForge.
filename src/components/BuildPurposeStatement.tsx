import {
  APPFORGE_BUILD_BOUNDARIES,
  APPFORGE_BUILD_PURPOSE,
  APPFORGE_WITHIN_BOUNDARIES,
  buildPurposeSummary,
} from "../lib/buildPurpose.js";

type Props = {
  compact?: boolean;
  showBoundaries?: boolean;
};

export function BuildPurposeStatement({
  compact,
  showBoundaries = true,
}: Props) {
  if (compact) {
    return (
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        {buildPurposeSummary()}
      </p>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          What AppForge can build
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
          {APPFORGE_BUILD_PURPOSE}
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 leading-relaxed">
          {APPFORGE_WITHIN_BOUNDARIES}
        </p>
      </div>
      {showBoundaries && (
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Boundaries — AppForge will not build:
          </h3>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-600 dark:text-slate-400 list-disc list-inside">
            {APPFORGE_BUILD_BOUNDARIES.map((b) => (
              <li key={b.id}>{b.label}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
