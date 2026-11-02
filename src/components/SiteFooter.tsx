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
    <footer className="border-t border-forge-border bg-forge-surface">
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between text-sm text-forge-text-muted">
        <div>
          <p className="font-semibold text-forge-text-primary">
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
            className="text-forge-gold hover:text-forge-gold-deep font-medium"
          >
            {t("footer.about")}
          </Link>
          <Link to="/help" className="hover:text-forge-text-primary">
            AppForge Support
          </Link>
          {TRUST_LINKS.map(([label, to]) => (
            <Link key={to} to={to} className="hover:text-forge-text-primary">
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
