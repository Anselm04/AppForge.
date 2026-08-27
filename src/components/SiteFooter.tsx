import { Link } from "react-router-dom";
import { useLocale } from "../i18n/LocaleContext.js";

export function SiteFooter() {
  const { t } = useLocale();
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-slate-600 dark:text-slate-400">
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-200">
            {t("footer.founder")}
          </p>
          <p>{t("footer.ownerOf")}</p>
        </div>
        <div className="flex flex-col sm:items-end gap-1">
          <Link to="/about" className="text-blue-600 hover:text-blue-700 font-medium">
            {t("footer.about")}
          </Link>
          <a href="mailto:hello@trillionaitech.com" className="hover:text-slate-900 dark:hover:text-white">
            hello@trillionaitech.com
          </a>
          <a href="mailto:support@trillionaitech.com" className="hover:text-slate-900 dark:hover:text-white">
            support@trillionaitech.com
          </a>
        </div>
      </div>
    </footer>
  );
}
