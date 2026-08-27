import { BUILD_CREDIT_COST } from "../lib/credits.js";

type Props = {
  credits?: number;
  cost?: number;
  action?: string;
};

export function CreditsPauseBanner({
  credits = 0,
  cost = BUILD_CREDIT_COST,
  action = "continue",
}: Props) {
  return (
    <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-lg p-4 text-amber-900 dark:text-amber-200">
      <p className="font-semibold text-lg">⏸️ Out of credits — work paused</p>
      <p className="mt-2 text-sm">
        You have {credits} credit{credits === 1 ? "" : "s"}; this action needs {cost} to {action}.
        Builds stay paused until you subscribe or buy extra credits.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <a
          href="/pricing"
          className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
        >
          Subscribe
        </a>
        <a
          href="/pricing#credits"
          className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
        >
          Buy extra credits
        </a>
      </div>
    </div>
  );
}
