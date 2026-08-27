import { BUILD_CREDIT_COST } from "../lib/credits.js";
import { useLocale } from "../i18n/LocaleContext.js";

type Props = {
  credits?: number;
  cost?: number;
  action?: string;
};

export function CreditsPauseBanner({
  credits = 0,
  cost = BUILD_CREDIT_COST,
  action,
}: Props) {
  const { t } = useLocale();
  const actionLabel = action || t("credits.actionStartBuild");

  return (
    <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-lg p-4 text-amber-900 dark:text-amber-200">
      <p className="font-semibold text-lg">⏸️ {t("credits.title")}</p>
      <p className="mt-2 text-sm">
        {t("credits.body", { credits, cost, action: actionLabel })}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <a
          href="/pricing"
          className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
        >
          {t("credits.subscribe")}
        </a>
        <a
          href="/pricing#credits"
          className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
        >
          {t("credits.buyExtra")}
        </a>
      </div>
    </div>
  );
}
