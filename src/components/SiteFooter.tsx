import { Link } from "react-router-dom";
import { useLocale } from "../i18n/LocaleContext.js";

const TRUST_LINKS = [
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
  ["Acceptable use", "/acceptable-use"],
  ["Refunds", "/refund-policy"],
  ["Security", "/security"],
] as const;

export function SiteFooter() {
  const { t } = useLocale();
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between text-sm text-slate-600 dark:text-slate-400">
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-200">
            {t("footer.founder")}
          </p>
          <p>{t("footer.ownerOf")}</p>
        </div>
        <nav
          aria-label="Footer"
          className="flex flex-wrap gap-x-4 gap-y-2 sm:justify-end sm:max-w-xl"
        >
          <Link
            to="/about"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            {t("footer.about")}
          </Link>
          <Link
            to="/help"
            className="hover:text-slate-900 dark:hover:text-white"
          >
            AppForge Support
          </Link>
          {TRUST_LINKS.map(([label, to]) => (
            <Link
              key={to}
              to={to}
              className="hover:text-slate-900 dark:hover:text-white"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
